import type { PixelImage } from '@mat/workerapi';
import { buildModelMasks, type ModelMasksInput } from '../model/buildModelMasks';
import { requantiseModelMasks, type RequantiseInput } from '../model/requantiseModelMasks';
import type { StepOutcome } from '../model/stepOutcome';
import { bakeCurrentRows, type BakedMaps, type MasksBuild } from '../pipeline/bakeCurrentRows';
import type { MasksRecord } from '../record/masksRecord';

/** Masks R24, R45: the heavy pure jobs (quantise, bake), each with what it takes and what it gives. */
export interface MaskJobs {
  bake: { input: { labels: PixelImage; record: MasksRecord }; output: BakedMaps };
  model: { input: ModelMasksInput; output: StepOutcome<MasksBuild> };
  requantise: { input: RequantiseInput; output: StepOutcome<MasksBuild> };
}
export type MaskJobKind = keyof MaskJobs;

/** Masks R24, R45: runs one job. The worker and the in-page fallback both call this, so they cannot differ. */
export function runMaskJob<K extends MaskJobKind>(kind: K, input: MaskJobs[K]['input']): MaskJobs[K]['output'] {
  switch (kind) {
    case 'bake': {
      const { labels, record } = input as MaskJobs['bake']['input'];
      return bakeCurrentRows(labels, record) as MaskJobs[K]['output'];
    }
    case 'model':
      return buildModelMasks(input as MaskJobs['model']['input']) as MaskJobs[K]['output'];
    case 'requantise':
      return requantiseModelMasks(input as MaskJobs['requantise']['input']) as MaskJobs[K]['output'];
    default:
      throw new Error(`Unknown masks job: ${String(kind)}`);
  }
}
