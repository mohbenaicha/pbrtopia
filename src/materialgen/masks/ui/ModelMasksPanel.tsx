import { useRef } from 'react';
import { useRevealOnTour } from '@shared/tutorial';
import { MasksPanel, type MasksPanelProps, type PanelRevealHandlers } from '@shared/materialMasks/ui';
import { REVEAL_MASK_SELECT } from '@mat/tutorial';
import { ModelRunNotice, RerunDecompositionButton, type MasksModelControls } from './ModelRunParts';

// Material gen always has a Height slot, so its panel keeps the Height props that the shared panel makes optional.
export type ModelMasksPanelProps = MasksPanelProps & Required<Pick<MasksPanelProps, 'onRowHeight' | 'hasHeightMap'>> & { model: MasksModelControls };

/**
 * Masks R48-R54, R59, R64-R68: the shared mask panel with material gen's parts filled in: the model run notice above the buttons, Re-run
 * decomposition beside Reset all, and the guided tour's reveal of the swatch block (tutorial R22).
 */
export function ModelMasksPanel({ model, ...panel }: ModelMasksPanelProps): React.JSX.Element {
  const reveal = useRef<PanelRevealHandlers | null>(null);
  useRevealOnTour(REVEAL_MASK_SELECT, { open: () => reveal.current?.open(), close: () => reveal.current?.close() });
  return (
    <MasksPanel
      {...panel}
      revealRef={reveal}
      notice={({ locked }) => <ModelRunNotice model={model} locked={locked} />}
      footer={({ locked, lockedReason }) => <RerunDecompositionButton model={model} locked={locked} lockedReason={lockedReason} />}
    />
  );
}
