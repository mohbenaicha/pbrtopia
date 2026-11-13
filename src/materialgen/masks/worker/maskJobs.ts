import type { PixelImage } from '@mat/workerapi';
import { bakeHeight } from '../bake/bakeHeight';
import { rowsToHeightOffsets } from '../record/maskRows';
import { buildModelMasks, type ModelMasksInput } from '../model/buildModelMasks';
import { requantiseModelMasks, type RequantiseInput } from '../model/requantiseModelMasks';
import type { StepOutcome } from '../model/stepOutcome';
import { bakeCurrentRows, type BakedMaps, type MasksBuild } from '../pipeline/bakeCurrentRows';
import type { MasksRecord } from '../record/masksRecord';

/** Masks R24, R45: the heavy pure jobs (quantise, bake), each with what it takes and what it gives. */
export interface MaskJobs {
  bake: { input: { labels: PixelImage; record: MasksRecord; grey?: PixelImage }; output: BakedMaps }; // grey: the albedo's, for the Colour mixin (R91)
  /** Masks R82: the Height map under the record's height offsets, from the base the caller names (R83). */
  height: { input: { labels: PixelImage; record: MasksRecord; base: PixelImage }; output: PixelImage };
  model: { input: ModelMasksInput; output: StepOutcome<MasksBuild> };
  requantise: { input: RequantiseInput; output: StepOutcome<MasksBuild> };
}
export type MaskJobKind = keyof MaskJobs;

/** Masks R24, R45: runs one job. The worker and the in-page fallback both call this, so they cannot differ. */
export function runMaskJob<K extends MaskJobKind>(kind: K, input: MaskJobs[K]['input']): MaskJobs[K]['output'] {
  switch (kind) {
    case 'bake': {
      const { labels, record, grey } = input as MaskJobs['bake']['input'];
      return bakeCurrentRows(labels, record, grey) as MaskJobs[K]['output'];
    }
    case 'height': {
      const { labels, record, base } = input as MaskJobs['height']['input'];
      return bakeHeight({ labels, offsets: rowsToHeightOffsets(record.rows), feather: record.feather, base }) as MaskJobs[K]['output'];
    }
    case 'model':
      return buildModelMasks(input as MaskJobs['model']['input']) as MaskJobs[K]['output'];
    case 'requantise':
      return requantiseModelMasks(input as MaskJobs['requantise']['input']) as MaskJobs[K]['output'];
    default:
      throw new Error(`Unknown masks job: ${String(kind)}`);
  }
}
