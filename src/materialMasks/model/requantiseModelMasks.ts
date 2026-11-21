import type { Edges } from '../edges';
import type { PixelImage } from '../imageTypes';
import { bakeCurrentRows, type MasksBuild } from '../pipeline/bakeCurrentRows';
import { quantiseToLabels } from '../quantise/quantiseLabels';
import type { MasksRecord } from '../record/masksRecord';
import type { StepOutcome } from './stepOutcome';

export interface RequantiseInput {
  picture: PixelImage; // the stored decomposition picture, at its own size
  record: MasksRecord; // source "model"
  size: number; // S
  edges?: Edges; // material-masks-core R5; 'wrap' when omitted
}

/**
 * Masks R17, R18, R20, R66: Re-quantise for a model source. No call is made: the stored picture is quantised again with the record's palette by
 * hue range and the bake is redone with the rows as the person left them.
 */
export function requantiseModelMasks({ picture, record, size, edges }: RequantiseInput): StepOutcome<MasksBuild> {
  const { labels } = quantiseToLabels(picture, record.palette, size, edges);
  return { ok: true, value: { labels, record, bake: bakeCurrentRows(labels, record, undefined, edges) } };
}
