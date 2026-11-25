import { describe, expect, it } from 'vitest';
import { clampReauthorParams } from '../../src/normalRecipe/clampReauthorParams';
import { ADOPTED_PARAMS, DEFAULT_PARAMS } from '../../src/normalRecipe/reauthorParams';

describe('clampReauthorParams', () => {
  it('normal-reauthor R4 the defaults are 45, 4 and 100 percent; an adopted picture starts with flatten 0', () => {
    expect(DEFAULT_PARAMS).toEqual({ slopeDeg: 45, seamRadius: 4, seamFlatten: 100 });
    expect(ADOPTED_PARAMS).toEqual({ slopeDeg: 45, seamRadius: 4, seamFlatten: 0 });
  });

  it.each([
    [4, 5], [5, 5], [45, 45], [80, 80], [81, 80], [45.5, 46], [-10, 5],
  ])('normal-reauthor R4 slopeDeg %s becomes %s', (given, expected) => {
    expect(clampReauthorParams({ slopeDeg: given }).slopeDeg).toBe(expected);
  });

  it.each([
    [-1, 0], [0, 0], [0.25, 0.5], [0.5, 0.5], [4, 4], [16, 16], [16.5, 16], [100, 16],
  ])('normal-reauthor R4 seamRadius %s becomes %s', (given, expected) => {
    expect(clampReauthorParams({ seamRadius: given }).seamRadius).toBe(expected);
  });

  it.each([
    [-1, 0], [0, 0], [7, 7], [7.5, 8], [50, 50], [100, 100], [101, 100],
  ])('normal-reauthor R4 seamFlatten %s percent becomes %s', (given, expected) => {
    expect(clampReauthorParams({ seamFlatten: given }).seamFlatten).toBe(expected);
  });

  it.each([[Number.NaN], [Number.POSITIVE_INFINITY], ['12'], [null], [undefined], [{}]])(
    'normal-reauthor R4 a value that is not a finite number (%s) takes the default of its field',
    (given) => {
      expect(clampReauthorParams({ slopeDeg: given, seamRadius: given, seamFlatten: given })).toEqual(DEFAULT_PARAMS);
    },
  );

  it('normal-reauthor R4 missing fields take their defaults', () => {
    expect(clampReauthorParams({})).toEqual(DEFAULT_PARAMS);
  });

  it('normal-reauthor I3 clamping is idempotent and always inside range for random input', () => {
    let state = 12345;
    const next = (): number => ((state = (state * 1103515245 + 12345) % 2147483648) / 2147483648) * 400 - 150;
    for (let run = 0; run < 500; run += 1) {
      const once = clampReauthorParams({ slopeDeg: next(), seamRadius: next(), seamFlatten: next() });
      expect(clampReauthorParams(once)).toEqual(once);
      expect(once.slopeDeg).toBeGreaterThanOrEqual(5);
      expect(once.slopeDeg).toBeLessThanOrEqual(80);
      expect(Number.isInteger(once.slopeDeg)).toBe(true);
      expect(once.seamRadius * 2).toBe(Math.round(once.seamRadius * 2));
      expect(once.seamRadius).toBeGreaterThanOrEqual(0);
      expect(once.seamRadius).toBeLessThanOrEqual(16);
      expect(Number.isInteger(once.seamFlatten)).toBe(true);
      expect(once.seamFlatten).toBeGreaterThanOrEqual(0);
      expect(once.seamFlatten).toBeLessThanOrEqual(100);
    }
  });
});
