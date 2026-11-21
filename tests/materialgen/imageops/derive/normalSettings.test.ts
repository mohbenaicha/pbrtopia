import { describe, expect, it } from 'vitest';
import { createDefaultNormalValues, normalControls, normalValuesFor, readNormalSettings, writeNormalSettings } from '@mat/imageops';

describe('imageops normalParams', () => {
  it('normal-from-height R6 the controls are Blur 0..4 step 0.05 (default 1) and Strength 5..80 step 1 (default 45), in one category', () => {
    expect(normalControls.map((c) => [c.id, c.min, c.max, c.step, c.defaultValue, c.category])).toEqual([
      ['blur', 0, 4, 0.05, 1, 'surface'],
      ['strength', 5, 80, 1, 45, 'surface'],
    ]);
    expect(createDefaultNormalValues()).toEqual({ blur: 1, strength: 45 });
  });

  it('normal-from-height R6 a record without remembered parameters gives the defaults', () => {
    expect(normalValuesFor(readNormalSettings(undefined))).toEqual({ blur: 1, strength: 45 });
  });

  it('normal-from-height R6 remembered values come back, the rest at default', () => {
    expect(normalValuesFor(readNormalSettings({ strength: 60 }))).toEqual({ blur: 1, strength: 60 });
  });

  it('normal-from-height R6 a remembered value outside its range is clamped, and one that is not a number is ignored', () => {
    expect(normalValuesFor(readNormalSettings({ blur: 99, strength: 1 }))).toEqual({ blur: 4, strength: 5 });
    expect(normalValuesFor(readNormalSettings({ blur: 'x', strength: null, extra: 3 }))).toEqual({ blur: 1, strength: 45 });
    expect(normalValuesFor(readNormalSettings(5 as never))).toEqual({ blur: 1, strength: 45 });
  });

  it('normal-from-height R6 saving gives the two parameters, the one missing at its default', () => {
    expect(writeNormalSettings({ blur: 0.5, strength: 70 })).toEqual({ blur: 0.5, strength: 70 });
    expect(writeNormalSettings({ strength: 20 })).toEqual({ blur: 1, strength: 20 });
  });
});
