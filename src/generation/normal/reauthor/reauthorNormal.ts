// normal-reauthor R5-R10: the whole re-authoring, from the base normal, in one pass. No DOM, no store.
import { fillReachTexels, seamRadiusTexels, type ReauthorParams } from '../../../normalRecipe/reauthorParams';
import { rasterizeIslandCoverage } from '../../../uvCoverage/rasterizeIslandCoverage';
import type { PixelPicture, UvMesh } from '../uprightTypes';
import { collectSeamSegments } from './collectSeamSegments';
import { computeSeamDistanceField } from './computeSeamDistanceField';
import { fillOutsideIslands } from './fillOutsideIslands';
import { flattenSlopesNearSeams } from './flattenSlopesNearSeams';
import { scaleSlope } from './scaleSlope';

const CODE_CENTRE = 128;
const CODE_UNIT = 127;
const MIN_Z_CODE = 129; // R5: every result keeps a positive z

function encodeSlopes(slopes: Float32Array, side: number): PixelPicture {
  const rgba = new Uint8ClampedArray(side * side * 4);
  for (let at = 0; at < side * side; at += 1) {
    const sx = slopes[at * 2]!;
    const sy = slopes[at * 2 + 1]!;
    const length = Math.sqrt(sx * sx + sy * sy + 1);
    rgba[at * 4] = Math.round((sx / length) * CODE_UNIT + CODE_CENTRE);
    rgba[at * 4 + 1] = Math.round((sy / length) * CODE_UNIT + CODE_CENTRE);
    rgba[at * 4 + 2] = Math.max(MIN_Z_CODE, Math.round((1 / length) * CODE_UNIT + CODE_CENTRE));
    rgba[at * 4 + 3] = 255;
  }
  return { side, rgba };
}

/** The re-authored normal of `base` for `params` (already clamped). Pure: the inputs are not changed. */
export function reauthorNormal(base: PixelPicture, mesh: UvMesh, params: ReauthorParams): PixelPicture {
  const { side } = base;
  const slopes = scaleSlope(base, params.slopeDeg);
  const radius = seamRadiusTexels(params.seamRadius, side);
  if (radius > 0 && params.seamFlatten > 0) {
    const pairs = collectSeamSegments(mesh, side);
    if (pairs.length > 0) flattenSlopesNearSeams(slopes, computeSeamDistanceField(pairs, side, radius), radius, params.seamFlatten / 100);
  }
  const result = encodeSlopes(slopes, side);
  fillOutsideIslands(result.rgba, rasterizeIslandCoverage(mesh, side), side, fillReachTexels(side));
  return result;
}
