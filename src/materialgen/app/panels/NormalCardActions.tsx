import { useState } from 'react';
import { DISCLOSURE_ICON_PIXELS, Icon, IconButton } from '@shared/ui-kit';

interface NormalCardActionsProps {
  hasHeight: boolean; // a height map exists
  canWrite: boolean;
  readOnlyReason: string;
  opOpen: boolean; // an op session is open (imageops R9)
  busy: boolean; // the normal map (or S) is being changed
  onOpenTool(): void;
  onRegenerate(): Promise<void>;
}

/** Normal-from-height R4, R8: the Normal tool and Regenerate normal, as icons on the Normal card. */
export function NormalCardActions({ hasHeight, canWrite, readOnlyReason, opOpen, busy, onOpenTool, onRegenerate }: NormalCardActionsProps): React.JSX.Element {
  const [regenerating, setRegenerating] = useState(false);
  const reason = !canWrite ? readOnlyReason : !hasHeight ? 'Needs a height map.' : opOpen ? 'Another edit is open. Apply or cancel it first.' : busy || regenerating ? 'This map is being changed.' : undefined;
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
      <IconButton label="Normal tool" hint="Opens the settings for the normal map." icon={<Icon name="normal-map" size={DISCLOSURE_ICON_PIXELS} />} disabled={reason !== undefined} {...(reason ? { disabledReason: reason } : {})} onClick={onOpenTool} />
      <IconButton label="Regenerate normal" hint="Recalculates the normal map from the current height map." icon={<Icon name="reset" size={DISCLOSURE_ICON_PIXELS} />} loading={regenerating} disabled={reason !== undefined && !regenerating} {...(reason ? { disabledReason: reason } : {})} onClick={() => void run()} />
    </>
  );
}
