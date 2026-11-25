// normal-reauthor R6-R8 and normal-height-edit R7: the tail shared by both heads (the old base normal and the new height):
// Seam flatten, encode to bytes, fill outside the islands. `slopes` is changed in place.
import { fillReachTexels, seamRadiusTexels, type ReauthorParams } from '../../../normalRecipe/reauthorParams';
import { rasterizeIslandCoverage } from '../../../uvCoverage/rasterizeIslandCoverage';
import type { PixelPicture, UvMesh } from '../uprightTypes';
import { collectSeamSegments } from './collectSeamSegments';
import { computeSeamDistanceField } from './computeSeamDistanceField';
import { fillOutsideIslands } from './fillOutsideIslands';
import { flattenSlopesNearSeams } from './flattenSlopesNearSeams';

const CODE_CENTRE = 128;
const CODE_UNIT = 127;
const MIN_Z_CODE = 129; // R5: every result keeps a positive z

export function encodeSlopes(slopes: Float32Array, side: number): PixelPicture {
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

/** What depends only on the mesh and the side: kept by a long-lived reauthorer so a release does not rebuild it. */
export interface TailCache {
  coverage: Uint8Array | null;
  seamFields: Map<number, Float32Array | null>; // by radius in texels; null: the mesh has no seams
}

export function createTailCache(): TailCache {
  return { coverage: null, seamFields: new Map() };
}

/** Slopes (interleaved x, y) -> flattened near seams -> the normal picture with the outside filled. The cache only saves time: the bytes are the same with or without it. */
export function tailFromSlopes(slopes: Float32Array, side: number, mesh: UvMesh, params: ReauthorParams, cache: TailCache = createTailCache()): PixelPicture {
  const radius = seamRadiusTexels(params.seamRadius, side);
  if (radius > 0 && params.seamFlatten > 0) {
    if (!cache.seamFields.has(radius)) {
      const pairs = collectSeamSegments(mesh, side);
      cache.seamFields.clear(); // one field held (16 MB at 2048), not one per radius ever tried
      cache.seamFields.set(radius,pairs.length > 0 ? computeSeamDistanceField(pairs, side, radius) : null);
    }
    const field = cache.seamFields.get(radius)!;
    if (field !== null) flattenSlopesNearSeams(slopes, field, radius, params.seamFlatten / 100);
  }
  const result = encodeSlopes(slopes, side);
  cache.coverage ??= rasterizeIslandCoverage(mesh, side);
  fillOutsideIslands(result.rgba, cache.coverage, side, fillReachTexels(side));
  return result;
}
