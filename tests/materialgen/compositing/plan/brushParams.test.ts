import { describe, expect, it } from 'vitest';
import { DEFAULT_BRUSH, clampBrush, stepRotation } from '../../../../src/materialgen/compositing/plan/brushParams';

describe('materialgen/compositing brush parameters (R9 R12)', () => {
  it('R9 the defaults are the ones of the spec', () => {
    expect(DEFAULT_BRUSH).toEqual({
      size: 0.12, strength: 1, hardness: 0.7, distance: 1, rotation: 0, randomRotation: false,
      height: { on: false, level: 0.3, additive: false }, edgeBurn: { on: false, direction: 'raise' },
    });
  });

  it('R9 every value is clamped to its range', () => {
    const clamped = clampBrush({ ...DEFAULT_BRUSH, size: 9, strength: -1, hardness: 2, distance: 0, rotation: 400, height: { on: true, level: 5, additive: true } });
    expect([clamped.size, clamped.strength, clamped.hardness, clamped.distance]).toEqual([0.5, 0, 1, 0.05]);
    expect(clamped.rotation).toBe(40);
    expect(clamped.height.level).toBe(1);
    expect(clampBrush({ ...DEFAULT_BRUSH, size: 0.001 }).size).toBe(0.02);
  });

  it('R9 a NaN value falls back to the default', () => {
    expect(clampBrush({ ...DEFAULT_BRUSH, size: Number.NaN }).size).toBe(DEFAULT_BRUSH.size);
  });

  it('R12 a notch turns 5 degrees, a fine notch 1, in the direction of the notch', () => {
    expect(stepRotation(0, 1, false)).toBe(5);
    expect(stepRotation(0, -1, false)).toBe(-5);
    expect(stepRotation(10, 2, true)).toBe(12);
  });

  it('R9 R12 the angle wraps into -180 to 180 (180 stays 180)', () => {
    expect(stepRotation(175, 2, false)).toBe(-175);
    expect(stepRotation(-175, -2, false)).toBe(175);
    expect(stepRotation(175, 1, false)).toBe(180);
  });
});
