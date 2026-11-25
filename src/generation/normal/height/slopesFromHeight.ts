import { slopeFactor } from '../../../normalRecipe/reauthorParams';
import { SLOPE_FLOOR } from '../uprightTypes';
import type { SmoothedHeight } from './heightTypes';

/**
 * normal-height-edit R6: the central difference of a height on each axis (half the difference of the two neighbours; y runs down the picture), two floats per texel.
 * A neighbour that is not a neighbour in an island (another island, no island, outside the picture) counts as the texel itself, so an island's border is no cliff.
 * Texels of no island are 0. The "unit" slopes are cached by the panel's worker; the gain is applied by `slopesFromUnit`.
 */
export function computeUnitSlopes(working: Float32Array, height: Pick<SmoothedHeight, 'owner' | 'side'>): Float32Array {
  const { owner, side } = height;
  const unit = new Float32Array(side * side * 2);
  for (let y = 0; y < side; y += 1) {
    for (let x = 0; x < side; x += 1) {
      const at = y * side + x;
      const mine = owner[at]!;
      if (mine === 0) continue;
      const centre = working[at]!;
      const reach = (px: number, py: number): number => {
        if (px < 0 || py < 0 || px >= side || py >= side) return centre;
        const other = py * side + px;
        return owner[other] === mine ? working[other]! : centre;
      };
      unit[at * 2] = (reach(x + 1, y) - reach(x - 1, y)) / 2;
      unit[at * 2 + 1] = (reach(x, y + 1) - reach(x, y - 1)) / 2;
    }
  }
  return unit;
}

/** The 95th percentile of the slope size over the texels an island owns (0 when there are none). */
export function computePercentile95Slope(unit: Float32Array, owner: Uint16Array): number {
  let count = 0;
  const sizes = new Float32Array(owner.length);
  for (let at = 0; at < owner.length; at += 1) {
    if (owner[at] === 0) continue;
    sizes[count] = Math.hypot(unit[at * 2]!, unit[at * 2 + 1]!);
    count += 1;
  }
  if (count === 0) return 0;
  const sorted = sizes.subarray(0, count).sort();
  return sorted[Math.min(count - 1, Math.floor(count * 0.95))]!;
}

/** (sx, sy) = (-gx * G, gy * G) with G = tan(slopeDeg) / max(p95, SLOPE_FLOOR): the slope field the re-author tail takes (x/z, y/z of the normal). */
export function slopesFromUnit(unit: Float32Array, slopeDeg: number, p95: number): Float32Array {
  const gain = slopeFactor(slopeDeg) / Math.max(p95, SLOPE_FLOOR); // slopeFactor is tan(slopeDeg), tan(45) being 1
  const slopes = new Float32Array(unit.length);
  for (let at = 0; at < unit.length; at += 2) {
    slopes[at] = -unit[at]! * gain;
    slopes[at + 1] = unit[at + 1]! * gain;
  }
  return slopes;
}
