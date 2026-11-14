import { useState } from 'react';
import { DISCLOSURE_ICON_PIXELS, Icon, IconButton } from '@shared/ui-kit';

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
      <IconButton label="AO tool" hint="Opens the settings for the occlusion map." icon={<Icon name="occlusion" size={DISCLOSURE_ICON_PIXELS} />} disabled={reason !== undefined} {...(reason ? { disabledReason: reason } : {})} onClick={onOpenTool} />
      <IconButton label="Regenerate AO" hint="Recalculates the occlusion map from the current height or normal map." icon={<Icon name="reset" size={DISCLOSURE_ICON_PIXELS} />} loading={regenerating} disabled={reason !== undefined && !regenerating} {...(reason ? { disabledReason: reason } : {})} onClick={() => void run()} />
    </>
  );
}
