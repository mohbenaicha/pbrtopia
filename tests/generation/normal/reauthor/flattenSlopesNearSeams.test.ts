import { describe, expect, it } from 'vitest';
import { flattenSlopesNearSeams } from '../../../../src/generation/normal/reauthor/flattenSlopesNearSeams';

// four texels at distances 0, 2, 4 and +Infinity from a seam, every slope (1, -2)
const setup = (): { slopes: Float32Array; distance: Float32Array } => ({
  slopes: new Float32Array([1, -2, 1, -2, 1, -2, 1, -2]),
  distance: new Float32Array([0, 2, 4, Number.POSITIVE_INFINITY]),
});

describe('flattenSlopesNearSeams', () => {
  it('normal-reauthor R6 at the seam the slope is multiplied by 1 - f; at the radius and beyond it is unchanged', () => {
    const { slopes, distance } = setup();
    flattenSlopesNearSeams(slopes, distance, 4, 1);
    expect(slopes[0]).toBeCloseTo(0, 6);
    expect(slopes[1]).toBeCloseTo(0, 6);
    expect(slopes[4]).toBeCloseTo(1, 6); // d = r
    expect(slopes[6]).toBe(1); // d = +Infinity
    expect(slopes[7]).toBe(-2);
  });

  it('normal-reauthor R6 halfway to the radius the factor is smoothstep(0.5) = 0.5', () => {
    const { slopes, distance } = setup();
    flattenSlopesNearSeams(slopes, distance, 4, 1);
    expect(slopes[2]).toBeCloseTo(0.5, 6);
    expect(slopes[3]).toBeCloseTo(-1, 6);
  });

  it('normal-reauthor R6 at f = 0.5 the seam keeps half of its slope on every texel (same factor both sides)', () => {
    const { slopes, distance } = setup();
    flattenSlopesNearSeams(slopes, distance, 4, 0.5);
    expect(slopes[0]).toBeCloseTo(0.5, 6);
    expect(slopes[1]).toBeCloseTo(-1, 6);
  });

  it('normal-reauthor R6 radius 0 or flatten 0 changes nothing', () => {
    for (const [radius, flatten] of [[0, 1], [4, 0]] as const) {
      const { slopes, distance } = setup();
      flattenSlopesNearSeams(slopes, distance, radius, flatten);
      expect(Array.from(slopes)).toEqual([1, -2, 1, -2, 1, -2, 1, -2]);
    }
  });

  it('normal-reauthor R6 the factor never decreases as the distance grows', () => {
    const distance = new Float32Array(41).map((_, at) => at * 0.1);
    const slopes = new Float32Array(82).fill(1);
    flattenSlopesNearSeams(slopes, distance, 4, 1);
    for (let at = 1; at < 41; at += 1) expect(slopes[at * 2]!).toBeGreaterThanOrEqual(slopes[(at - 1) * 2]! - 1e-7);
  });
});
