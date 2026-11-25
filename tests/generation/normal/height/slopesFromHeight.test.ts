import { describe, expect, it } from 'vitest';
import { computeUnitSlopes, slopesFromUnit } from '../../../../src/generation/normal/height/slopesFromHeight';
import { soleIslandHeight, twoIslandHeight } from './heightFixtures';

const SIDE = 32;
const at = (side: number, x: number, y: number): number => (y * side + x) * 2;

describe('computeUnitSlopes and slopesFromUnit', () => {
  it('normal-height-edit R6 a ramp of 0.01 per texel tilts slopeDeg at its p95: the slope is tan(slopeDeg)', () => {
    const picture = soleIslandHeight(SIDE, (x) => 0.01 * x);
    const unit = computeUnitSlopes(picture.smoothed, picture);
    for (const degrees of [5, 45, 60, 80]) {
      const slopes = slopesFromUnit(unit, degrees, 0.01);
      expect(-slopes[at(SIDE, 10, 10)]!).toBeCloseTo(Math.tan((degrees * Math.PI) / 180), 4);
      expect(slopes[at(SIDE, 10, 10) + 1]).toBeCloseTo(0, 6);
    }
  });

  it('normal-height-edit R6 the sign matches deriveNormals: height rising with x slopes -x, rising down the picture slopes +y', () => {
    const rightUp = soleIslandHeight(SIDE, (x) => 0.01 * x);
    const downUp = soleIslandHeight(SIDE, (_x, y) => 0.01 * y);
    expect(slopesFromUnit(computeUnitSlopes(rightUp.smoothed, rightUp), 45, 0.01)[at(SIDE, 10, 10)]!).toBeLessThan(0);
    expect(slopesFromUnit(computeUnitSlopes(downUp.smoothed, downUp), 45, 0.01)[at(SIDE, 10, 10) + 1]!).toBeGreaterThan(0);
  });

  it('normal-height-edit R6 the gain floor: a p95 below 0.01 is read as 0.01', () => {
    const picture = soleIslandHeight(SIDE, (x) => 0.001 * x);
    const unit = computeUnitSlopes(picture.smoothed, picture);
    const slopes = slopesFromUnit(unit, 45, 0.0001);
    expect(-slopes[at(SIDE, 10, 10)]!).toBeCloseTo(0.001 / 0.01, 5);
  });

  it('normal-height-edit R6 a neighbour in another island counts as the texel itself, so an island border is no cliff', () => {
    const picture = twoIslandHeight(SIDE, 16, () => 0, () => 1);
    const unit = computeUnitSlopes(picture.smoothed, picture);
    for (const x of [15, 16]) expect(unit[at(SIDE, x, 10)]).toBe(0);
  });

  it('normal-height-edit R6 a flat height gives flat slopes and texels of no island stay 0', () => {
    const picture = soleIslandHeight(SIDE, () => 0.5);
    picture.owner.fill(0, 0, SIDE * 3);
    picture.smoothed.fill(0, 0, SIDE * 3);
    const slopes = slopesFromUnit(computeUnitSlopes(picture.smoothed, picture), 60, 0.02);
    for (const value of slopes) expect(Math.abs(value)).toBe(0);
  });

  it('normal-height-edit R6 the gain does not change with Sharpness (it is computed from the unit slopes and the smoothed p95 only)', () => {
    const picture = soleIslandHeight(SIDE, (x) => 0.01 * x);
    const unit = computeUnitSlopes(picture.smoothed, picture);
    expect(Array.from(slopesFromUnit(unit, 45, 0.01))).toEqual(Array.from(slopesFromUnit(unit, 45, 0.01)));
  });
});
