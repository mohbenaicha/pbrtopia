import { describe, expect, it } from 'vitest';
import { dilateGutter, gutterReach } from '../../../src/materialMasks';
import { computeNearestIslandTexels, fillGutterFromTable } from '../../../src/materialMasks/bake/nearestIslandTexels';
import { greyPlane, seededRandom } from '../../support/maskBakeFixtures';

/** The rule of mask-mode R28 written the slow way: the nearest island texel (Euclidean between centres, ties by lower row, then lower column) within the reach. */
function bruteForceTable(coverage: Uint8Array, side: number): Int32Array {
  const reach = gutterReach(side);
  const table = new Int32Array(side * side).fill(-1);
  for (let row = 0; row < side; row += 1) {
    for (let column = 0; column < side; column += 1) {
      if (coverage[row * side + column] === 1) continue;
      let best = -1;
      let bestD2 = Infinity;
      for (let y = Math.max(0, row - reach); y <= Math.min(side - 1, row + reach); y += 1) {
        for (let x = Math.max(0, column - reach); x <= Math.min(side - 1, column + reach); x += 1) {
          if (coverage[y * side + x] !== 1) continue;
          const d2 = (y - row) ** 2 + (x - column) ** 2;
          if (d2 > reach * reach) continue;
          if (d2 < bestD2 || (d2 === bestD2 && (y < Math.floor(best / side) || (y === Math.floor(best / side) && x < best % side)))) {
            best = y * side + x;
            bestD2 = d2;
          }
        }
      }
      table[row * side + column] = best;
    }
  }
  return table;
}

function randomCoverage(side: number, random: () => number, blobs: number): Uint8Array {
  const coverage = new Uint8Array(side * side);
  for (let blob = 0; blob < blobs; blob += 1) {
    const cx = Math.floor(random() * side);
    const cy = Math.floor(random() * side);
    const w = 3 + Math.floor(random() * 30);
    const h = 3 + Math.floor(random() * 30);
    for (let y = cy; y < Math.min(side, cy + h); y += 1) for (let x = cx; x < Math.min(side, cx + w); x += 1) coverage[y * side + x] = 1;
  }
  return coverage;
}

describe('computeNearestIslandTexels (mask-bake-session R9)', () => {
  it('mask-bake-session R9 equals the nearest-island rule for random coverages, ties included, and holds -1 for island texels and texels beyond reach', () => {
    const random = seededRandom(5);
    for (const side of [64, 200, 256]) {
      for (let round = 0; round < 3; round += 1) {
        const coverage = randomCoverage(side, random, 6 + round * 4);
        expect(Array.from(computeNearestIslandTexels(coverage, side))).toEqual(Array.from(bruteForceTable(coverage, side)));
      }
    }
  });

  it('mask-bake-session R9 a fill from the table equals dilateGutter byte for byte, for both maps', () => {
    const random = seededRandom(9);
    const side = 256;
    const coverage = randomCoverage(side, random, 14);
    const maps = { rough: greyPlane(side, () => Math.floor(random() * 256)), metal: greyPlane(side, () => Math.floor(random() * 256)) };
    const want = dilateGutter(maps, coverage);
    const got = fillGutterFromTable([maps.rough, maps.metal], computeNearestIslandTexels(coverage, side));
    expect(Array.from(got[0]!.data)).toEqual(Array.from(want.rough.data));
    expect(Array.from(got[1]!.data)).toEqual(Array.from(want.metal.data));
  });

  it('mask-bake-session R9 a fill from the table does not change its input planes', () => {
    const side = 64;
    const coverage = randomCoverage(side, seededRandom(1), 4);
    const plane = greyPlane(side, (index) => index % 251);
    const before = Array.from(plane.data);
    fillGutterFromTable([plane], computeNearestIslandTexels(coverage, side));
    expect(Array.from(plane.data)).toEqual(before);
  });
});
