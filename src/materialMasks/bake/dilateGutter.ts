import type { PixelImage } from '../imageTypes';
import type { BakedMaps } from '../pipeline/bakeCurrentRows';
import { computeNearestIslandTexels, fillGutterFromTable, gutterReach } from './nearestIslandTexels';

export { gutterReach };

/**
 * mask-mode R28: every gutter texel (one that `coverage` does not mark as under an island triangle) within `gutterReach` of an island texel takes that nearest island texel's rough
 * and metal; nearest is Euclidean between texel centres, ties by lower row, then lower column. Everything else keeps the bake's pixel. Returns new maps; the input is unchanged.
 * `coverage` is one byte per texel (1 = island), the maps' size squared. Pure and deterministic; the nearest-island search is in `nearestIslandTexels.ts`.
 */
export function dilateGutter(maps: BakedMaps, coverage: Uint8Array): BakedMaps {
  const [rough, metal] = dilateGutterPlanes([maps.rough, maps.metal], coverage);
  return { rough: rough!, metal: metal! };
}

/** Mask-bake-session R4: the same fill for any set of maps of one size (the fill reads only the coverage and each map's own bytes, so one map alone gets the bytes it gets in `dilateGutter`). */
export function dilateGutterPlanes(planes: readonly PixelImage[], coverage: Uint8Array): PixelImage[] {
  const side = planes[0]?.width ?? 0;
  if (planes.some((plane) => plane.width !== side || plane.height !== side) || coverage.length !== side * side) throw new RangeError('The coverage must have one byte per texel of the maps.');
  return fillGutterFromTable(planes, computeNearestIslandTexels(coverage, side));
}
