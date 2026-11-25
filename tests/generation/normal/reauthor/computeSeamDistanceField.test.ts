import { describe, expect, it } from 'vitest';
import { computeSeamDistanceField } from '../../../../src/generation/normal/reauthor/computeSeamDistanceField';
import type { SeamSegment, SeamSegmentPair } from '../../../../src/generation/normal/reauthor/collectSeamSegments';
import { seededRandom } from './reauthorFixtures';

function distanceToSegment(px: number, py: number, s: SeamSegment): number {
  const dx = s[2] - s[0];
  const dy = s[3] - s[1];
  const lengthSquared = dx * dx + dy * dy;
  const t = lengthSquared === 0 ? 0 : Math.min(1, Math.max(0, ((px - s[0]) * dx + (py - s[1]) * dy) / lengthSquared));
  return Math.hypot(s[0] + t * dx - px, s[1] + t * dy - py);
}

describe('computeSeamDistanceField', () => {
  const pair: SeamSegmentPair = [[40, 10, 40, 40], [60, 10, 60, 40]];

  it('normal-reauthor R6 a texel takes the distance from its centre to the nearest segment', () => {
    const field = computeSeamDistanceField([pair], 100, 10);
    expect(field[20 * 100 + 44]).toBeCloseTo(4.5, 3); // centre (44.5, 20.5), segment x = 40
    expect(field[20 * 100 + 39]).toBeCloseTo(0.5, 3);
    expect(field[20 * 100 + 56]).toBeCloseTo(3.5, 3); // nearer to the second segment at x = 60
  });

  it('normal-reauthor R6 a texel farther than the reach is +Infinity', () => {
    const field = computeSeamDistanceField([pair], 100, 10);
    expect(field[50 * 100 + 40]).toBe(Number.POSITIVE_INFINITY); // centre (40.5, 50.5), 10.5 below the end point (40, 40): beyond reach 10...
    expect(field[20 * 100 + 80]).toBe(Number.POSITIVE_INFINITY); // 20.5 from the nearer segment
  });

  it('normal-reauthor R6 no segments, or reach 0, gives +Infinity everywhere', () => {
    expect(Array.from(computeSeamDistanceField([], 16, 5)).every((value) => value === Number.POSITIVE_INFINITY)).toBe(true);
    expect(Array.from(computeSeamDistanceField([pair], 100, 0)).every((value) => value === Number.POSITIVE_INFINITY)).toBe(true);
  });

  it('normal-reauthor R6 the field equals brute force (within 1e-3) for random segments', () => {
    const random = seededRandom(7);
    const side = 32;
    const reach = 6;
    const pairs: SeamSegmentPair[] = [];
    for (let at = 0; at < 6; at += 1) {
      const a: SeamSegment = [random() * side, random() * side, random() * side, random() * side];
      const b: SeamSegment = [random() * side, random() * side, random() * side, random() * side];
      pairs.push([a, b]);
    }
    const field = computeSeamDistanceField(pairs, side, reach);
    for (let row = 0; row < side; row += 1) {
      for (let column = 0; column < side; column += 1) {
        let best = Number.POSITIVE_INFINITY;
        for (const [a, b] of pairs) best = Math.min(best, distanceToSegment(column + 0.5, row + 0.5, a), distanceToSegment(column + 0.5, row + 0.5, b));
        const expected = best <= reach ? best : Number.POSITIVE_INFINITY;
        const got = field[row * side + column]!;
        if (expected === Number.POSITIVE_INFINITY) expect(got === Number.POSITIVE_INFINITY || Math.abs(got - best) < 1e-3).toBe(true); // at the edge of the reach either is acceptable
        else expect(Math.abs(got - expected)).toBeLessThan(1e-3);
      }
    }
  });

  it('normal-reauthor R6 a segment partly outside the picture does not write outside it', () => {
    const field = computeSeamDistanceField([[[-5, -5, 3, 3], [90, 90, 120, 120]]], 32, 4);
    expect(field.length).toBe(32 * 32);
    expect(field[0]).toBeLessThan(2);
  });
});
