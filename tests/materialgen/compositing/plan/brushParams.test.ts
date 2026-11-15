import { describe, expect, it } from 'vitest';
import { BRUSH_CONTROLS, DEFAULT_BRUSH, clampBrush, drawBrushValue, stepRotation, updateBrushValue, type BrushValue } from '../../../../src/materialgen/compositing/plan/brushParams';

const value = (patch: Partial<BrushValue>): BrushValue => ({ value: 0.5, random: false, low: 0, high: 1, ...patch });

describe('materialgen/compositing brush parameters (R9 R12 R50)', () => {
  it('R77 the Burn width is clamped to 1 to 10 and rounded to a whole texel; a missing or non-finite width reads 2', () => {
    const widthOf = (width: unknown): number => clampBrush({ ...DEFAULT_BRUSH, edgeBurn: { ...DEFAULT_BRUSH.edgeBurn, width: width as number } }).edgeBurn.width;
    expect(widthOf(0)).toBe(1);
    expect(widthOf(99)).toBe(10);
    expect(widthOf(3.4)).toBe(3);
    expect(widthOf(3.6)).toBe(4);
    expect(widthOf(Number.NaN)).toBe(2);
    expect(widthOf(Number.POSITIVE_INFINITY)).toBe(2);
    expect(widthOf(undefined)).toBe(2);
    expect(clampBrush({ ...DEFAULT_BRUSH, edgeBurn: { on: true, direction: 'dent' } as never }).edgeBurn).toEqual({ on: true, direction: 'dent', width: 2 });
  });

  it('R9 R50 the defaults are the ones of the spec: single values, dice off, the range at the two ends of the control', () => {
    expect(DEFAULT_BRUSH.size).toEqual({ value: 0.12, random: false, low: 0.02, high: 1 });
    expect(DEFAULT_BRUSH.strength).toEqual({ value: 1, random: false, low: 0, high: 1 });
    expect(DEFAULT_BRUSH.hardness).toEqual({ value: 0.7, random: false, low: 0, high: 1 });
    expect(DEFAULT_BRUSH.distance).toEqual({ value: 1, random: false, low: 0.05, high: 2 });
    expect(DEFAULT_BRUSH.rotation).toEqual({ value: 0, random: false, low: -180, high: 180 });
    expect(DEFAULT_BRUSH.height).toEqual({ on: false, level: 0.3, additive: false });
    expect(DEFAULT_BRUSH.edgeBurn).toEqual({ on: false, direction: 'raise', width: 2 });
    expect('randomRotation' in DEFAULT_BRUSH).toBe(false);
  });

  it('R9 the control table holds each range once; Size reaches the whole picture', () => {
    expect([BRUSH_CONTROLS.size.min, BRUSH_CONTROLS.size.max]).toEqual([0.02, 1]);
    expect([BRUSH_CONTROLS.strength.min, BRUSH_CONTROLS.strength.max]).toEqual([0, 1]);
    expect([BRUSH_CONTROLS.hardness.min, BRUSH_CONTROLS.hardness.max]).toEqual([0, 1]);
    expect([BRUSH_CONTROLS.distance.min, BRUSH_CONTROLS.distance.max]).toEqual([0.05, 2]);
    expect([BRUSH_CONTROLS.rotation.min, BRUSH_CONTROLS.rotation.max]).toEqual([-180, 180]);
  });

  it('R9 every value is clamped to its range (Size now up to 1)', () => {
    const clamped = clampBrush({ ...DEFAULT_BRUSH, size: value({ value: 9 }), strength: value({ value: -1 }), hardness: value({ value: 2 }), distance: value({ value: 0 }), rotation: value({ value: 400 }), height: { on: true, level: 5, additive: true } });
    expect([clamped.size.value, clamped.strength.value, clamped.hardness.value, clamped.distance.value]).toEqual([1, 0, 1, 0.05]);
    expect(clamped.rotation.value).toBe(40);
    expect(clamped.height.level).toBe(1);
    expect(clampBrush({ ...DEFAULT_BRUSH, size: value({ value: 0.001 }) }).size.value).toBe(0.02);
  });

  it('R9 a NaN value falls back to the default, in the value and in each end of the range', () => {
    const clamped = clampBrush({ ...DEFAULT_BRUSH, size: value({ value: Number.NaN, low: Number.NaN, high: Number.NaN }) });
    expect(clamped.size).toEqual(DEFAULT_BRUSH.size);
  });

  it('R50 the ends of a range are clamped to the control and kept in order (low never passes high)', () => {
    const clamped = clampBrush({ ...DEFAULT_BRUSH, strength: value({ random: true, low: 0.9, high: 0.2 }), hardness: value({ random: true, low: -3, high: 4 }) });
    expect([clamped.strength.low, clamped.strength.high]).toEqual([0.2, 0.9]);
    expect([clamped.hardness.low, clamped.hardness.high]).toEqual([0, 1]);
    expect(clamped.strength.random).toBe(true);
  });

  it('R50 updateBrushValue changes one control and leaves the others as they were', () => {
    const next = updateBrushValue(DEFAULT_BRUSH, 'size', { random: true, low: 0.1 });
    expect(next.size).toEqual({ value: 0.12, random: true, low: 0.1, high: 1 });
    expect(next.strength).toBe(DEFAULT_BRUSH.strength);
    expect(DEFAULT_BRUSH.size.random).toBe(false);
  });

  it('R52 an inactive control draws its value; an active one maps the draw onto its range', () => {
    expect(drawBrushValue(value({ value: 0.3, low: 0.1, high: 0.9 }), BRUSH_CONTROLS.strength, 0.77)).toBe(0.3);
    const active = value({ value: 0.3, random: true, low: 0.2, high: 0.6 });
    expect(drawBrushValue(active, BRUSH_CONTROLS.strength, 0)).toBeCloseTo(0.2, 12);
    expect(drawBrushValue(active, BRUSH_CONTROLS.strength, 0.5)).toBeCloseTo(0.4, 12);
    expect(drawBrushValue(active, BRUSH_CONTROLS.strength, 0.999999)).toBeLessThan(0.6);
  });

  it('R52 a drawn value is clamped to the control, and equal ends give that exact value', () => {
    expect(drawBrushValue(value({ random: true, low: -5, high: 7 }), BRUSH_CONTROLS.strength, 1)).toBe(1);
    expect(drawBrushValue(value({ random: true, low: -5, high: 7 }), BRUSH_CONTROLS.strength, 0)).toBe(0);
    expect(drawBrushValue(value({ random: true, low: 0.4, high: 0.4 }), BRUSH_CONTROLS.strength, 0.31)).toBe(0.4);
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
