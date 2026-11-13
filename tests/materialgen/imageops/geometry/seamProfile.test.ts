import { describe, expect, it } from 'vitest';
import { SEAM_PROFILE_MAX_SIDE, decodeSeamDepth, measureEdgeDistances, seamDepthOf, shapeSeamProfile } from '@mat/imageops/geometry/seamProfile';
import type { PixelImage } from '@mat/imageops';

const grey = (side: number, valueAt: (x: number, y: number) => number): PixelImage => {
  const data = new Uint8Array(side * side);
  for (let y = 0; y < side; y += 1) for (let x = 0; x < side; x += 1) data[y * side + x] = valueAt(x, y);
  return { width: side, height: side, channels: 1, data };
};

describe('materialgen/imageops seamProfile', () => {
  it('R65 the fixed depth is half of what is left after the fade start: 55 gives 22.5 % of the side', () => {
    expect(seamDepthOf(55)).toBeCloseTo(0.225, 6);
    expect(seamDepthOf(5)).toBeCloseTo(0.475, 6);
    expect(seamDepthOf(95)).toBeCloseTo(0.025, 6);
  });

  it('R66 a step edge 5 % in from the left ends the left zone within 3 texels of it, and a flat map has no edge so every line takes 5 %', () => {
    const stepped = measureEdgeDistances(grey(100, (x) => (x < 5 ? 40 : 100 + x)));
    const profile = shapeSeamProfile(stepped, seamDepthOf(55));
    const rowDepth = decodeSeamDepth(profile, 'rows', 50);
    expect(rowDepth * 100).toBeGreaterThanOrEqual(2);
    expect(rowDepth * 100).toBeLessThanOrEqual(8);
    const flat = shapeSeamProfile(measureEdgeDistances(grey(100, () => 120)), seamDepthOf(55));
    expect(decodeSeamDepth(flat, 'rows', 50)).toBeCloseTo(0.05, 2);
    expect(decodeSeamDepth(flat, 'columns', 50)).toBeCloseTo(0.05, 2);
  });

  it('R66 the depth is never more than the fixed depth', () => {
    const profile = shapeSeamProfile(measureEdgeDistances(grey(100, () => 120)), seamDepthOf(95)); // fixed depth 2.5 %, below the 5 % of a flat map
    expect(decodeSeamDepth(profile, 'rows', 50)).toBeLessThanOrEqual(0.026);
  });

  it('R66 a map larger than the limit is reduced, so the profile never holds more than that many texels per line', () => {
    const distances = measureEdgeDistances(grey(1200, (x) => (x < 60 ? 40 : 200)));
    expect(distances.size).toBe(SEAM_PROFILE_MAX_SIDE);
    expect(shapeSeamProfile(distances, seamDepthOf(55))).toHaveLength(SEAM_PROFILE_MAX_SIDE * 2);
  });

  it('R66 moving the slider re-shapes the same measured distances: the same input gives the same profile, a deeper fixed depth never gives a shallower zone', () => {
    const distances = measureEdgeDistances(grey(100, (x) => (x < 30 ? 40 : 200)));
    const shallow = shapeSeamProfile(distances, seamDepthOf(90));
    const deep = shapeSeamProfile(distances, seamDepthOf(20));
    expect(shapeSeamProfile(distances, seamDepthOf(90))).toEqual(shallow);
    expect(decodeSeamDepth(deep, 'rows', 50)).toBeGreaterThanOrEqual(decodeSeamDepth(shallow, 'rows', 50));
  });
});
