import { useState } from 'react';
import { Icon, IconButton } from '@shared/ui-kit';

interface AoCardActionsProps {
  hasSource: boolean; // a height or a normal map exists
  canWrite: boolean;
  readOnlyReason: string;
  opOpen: boolean; // an op session is open (imageops R9)
  busy: boolean; // the AO map is being changed
  onOpenTool(): void;
  onRegenerate(): Promise<void>;
}

/** Imageops R43, R44: the AO tool and Regenerate, as icons in the Maps heading bar. */
export function AoCardActions({ hasSource, canWrite, readOnlyReason, opOpen, busy, onOpenTool, onRegenerate }: AoCardActionsProps): React.JSX.Element {
  const [regenerating, setRegenerating] = useState(false);
  const reason = !canWrite ? readOnlyReason : !hasSource ? 'Needs a height or normal map.' : opOpen ? 'Another edit is open. Apply or cancel it first.' : busy || regenerating ? 'This map is being changed.' : undefined;
  const run = async (): Promise<void> => {
    setRegenerating(true);
    try {
      await onRegenerate();
    } finally {
      setRegenerating(false);
    }
  };
  return (
    <>
      <IconButton label="AO tool" icon={<Icon name="occlusion" size={16} />} disabled={reason !== undefined} {...(reason ? { disabledReason: reason } : {})} onClick={onOpenTool} />
      <IconButton label="Regenerate AO" icon={<Icon name="reset" size={16} />} loading={regenerating} disabled={reason !== undefined && !regenerating} {...(reason ? { disabledReason: reason } : {})} onClick={() => void run()} />
    </>
  );
}
