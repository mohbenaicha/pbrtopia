import { describe, expect, it } from 'vitest';
import { chooseGridStep } from '../../src/viewMarks';

describe('chooseGridStep', () => {
  it.each([
    [10, 1],
    [18, 2],
    [35, 5], // halfway between 2 and 5: the larger
    [2, 0.2],
    [1000, 100],
    [0.07, 0.005], // 0.007 is nearer 0.005 than 0.01
  ])('R3 a model %s units long has major steps of %s', (longest, step) => {
    expect(chooseGridStep(longest)).toBeCloseTo(step, 10);
  });

  it.each([0, -1, Number.NaN, Number.POSITIVE_INFINITY])('R3 no grid for a longest side of %s', (longest) => {
    expect(chooseGridStep(longest)).toBe(0);
  });
});
