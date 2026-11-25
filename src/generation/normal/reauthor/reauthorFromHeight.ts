// normal-height-edit R5-R8, R11: the normal from the stored height. Each slider redoes only what it changes:
// Sharpness -> working height + unit slopes; Strength -> a multiply; Blend / Flatten -> the tail only.
import type { ReauthorParams } from '../../../normalRecipe/reauthorParams';
import { buildWorkingHeight } from '../height/buildWorkingHeight';
import type { SharpnessDeltas, SmoothedHeight } from '../height/heightTypes';
import { prepareSharpness } from '../height/prepareSharpness';
import { computeUnitSlopes, slopesFromUnit } from '../height/slopesFromHeight';
import type { PixelPicture, UvMesh } from '../uprightTypes';
import { createTailCache, tailFromSlopes } from './tailFromSlopes';

export interface HeightReauthorStats {
  deltas: number; // times the Sharpness deltas were computed
  workingHeights: number; // times a working height was built (never at Sharpness 0)
  unitSlopes: number; // times the unit slopes were computed
}

export interface HeightReauthorer {
  /** Pays the one-time Sharpness cost now (panel load); a generation at Sharpness 0 never calls it. */
  prepare(): void;
  reauthor(params: ReauthorParams): PixelPicture;
  readonly stats: HeightReauthorStats;
}

export function createHeightReauthorer(height: SmoothedHeight, mesh: UvMesh): HeightReauthorer {
  const stats: HeightReauthorStats = { deltas: 0, workingHeights: 0, unitSlopes: 0 };
  let deltas: SharpnessDeltas | null = null;
  let cached: { sharpness: number; unit: Float32Array } | null = null;
  const tailCache = createTailCache(); // seam fields and island coverage depend on the mesh only

  const loadDeltas = (): SharpnessDeltas => {
    if (deltas === null) {
      deltas = prepareSharpness(height);
      stats.deltas += 1;
    }
    return deltas;
  };

  const unitSlopesFor = (sharpness: number): Float32Array => {
    if (cached !== null && cached.sharpness === sharpness) return cached.unit;
    let working = height.smoothed;
    if (sharpness > 0) {
      working = buildWorkingHeight(height, loadDeltas(), sharpness);
      stats.workingHeights += 1;
    }
    const unit = computeUnitSlopes(working, height);
    stats.unitSlopes += 1;
    cached = { sharpness, unit };
    return unit;
  };

  return {
    prepare: () => {
      loadDeltas();
    },
    reauthor: (params) => tailFromSlopes(slopesFromUnit(unitSlopesFor(params.sharpness), params.slopeDeg, height.p95), height.side, mesh, params, tailCache),
    stats,
  };
}

/** One-shot form: the same bytes as every path of the reauthorer (R8). */
export function reauthorFromHeight(height: SmoothedHeight, mesh: UvMesh, params: ReauthorParams): PixelPicture {
  return createHeightReauthorer(height, mesh).reauthor(params);
}
