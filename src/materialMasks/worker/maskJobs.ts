import type { Edges } from '../edges';
import type { PixelImage } from '../imageTypes';
import { buildModelMasks, type ModelMasksInput } from '../model/buildModelMasks';
import { requantiseModelMasks, type RequantiseInput } from '../model/requantiseModelMasks';
import type { StepOutcome } from '../model/stepOutcome';
import { bakeCurrentRows, type BakedMaps, type MasksBuild } from '../pipeline/bakeCurrentRows';
import type { MasksRecord } from '../record/masksRecord';

/**
 * Masks R24, R45: the heavy pure jobs the core registers (quantise, bake), each with what it takes and what it gives. Material gen's height job
 * is not here: materialgen registers it from its own `bakeHeight` (material-masks-core R1).
 */
export interface MaskJobs {
  bake: { input: { labels: PixelImage; record: MasksRecord; grey?: PixelImage; edges?: Edges; base?: BakedMaps; keep?: Uint8Array; coverage?: Uint8Array }; output: BakedMaps }; // grey: the albedo's, for the Colour mixin (R91)
  model: { input: ModelMasksInput; output: StepOutcome<MasksBuild> };
  requantise: { input: RequantiseInput; output: StepOutcome<MasksBuild> };
}
export type MaskJobKind = keyof MaskJobs;

/** Masks R24, R45: runs one job. The worker and the in-page fallback both call this, so they cannot differ. */
export function runMaskJob<K extends MaskJobKind>(kind: K, input: MaskJobs[K]['input']): MaskJobs[K]['output'] {
  switch (kind) {
    case 'bake': {
      const { labels, record, grey, edges, base, keep, coverage } = input as MaskJobs['bake']['input'];
      return bakeCurrentRows(labels, record, grey, edges, base, keep, coverage) as MaskJobs[K]['output'];
    }
    case 'model':
      return buildModelMasks(input as MaskJobs['model']['input']) as MaskJobs[K]['output'];
    case 'requantise':
      return requantiseModelMasks(input as MaskJobs['requantise']['input']) as MaskJobs[K]['output'];
    default:
      throw new Error(`Unknown masks job: ${String(kind)}`);
  }
}
