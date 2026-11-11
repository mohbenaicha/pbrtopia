import { describe, expect, it } from 'vitest';
import { aoValuesFor, createDefaultAoValues, readAoSettings, writeAoSettings } from '@mat/imageops';

describe('imageops aoSettings', () => {
  it('R43 a record without remembered parameters gives the defaults of each source', () => {
    const settings = readAoSettings(undefined);
    expect(settings.source).toBeUndefined();
    expect(aoValuesFor(settings, 'height')).toEqual(createDefaultAoValues('height'));
    expect(aoValuesFor(settings, 'normal')).toEqual(createDefaultAoValues('normal'));
  });

  it('R43 remembered values come back for the source they were saved for, the rest at default', () => {
    const settings = readAoSettings({ source: 'normal', normal: { spread: 20 }, height: { depth: 3 } });
    expect(settings.source).toBe('normal');
    expect(aoValuesFor(settings, 'normal')).toEqual({ ...createDefaultAoValues('normal'), spread: 20 });
    expect(aoValuesFor(settings, 'height')).toEqual({ ...createDefaultAoValues('height'), depth: 3 });
  });

  it('R43 a remembered value outside its range is clamped, and one that is not a number is ignored', () => {
    const settings = readAoSettings({ height: { depth: 99, strength: 'x', spread: null, unknown: 5 } });
    const values = aoValuesFor(settings, 'height');
    expect(values['depth']).toBe(12);
    expect(values['strength']).toBe(createDefaultAoValues('height')['strength']);
    expect(values['spread']).toBe(createDefaultAoValues('height')['spread']);
    expect(Object.keys(values).sort()).toEqual(['depth', 'spread', 'strength']);
  });

  it('R43 a stored source that is not height or normal is ignored, and so is a value that is not an object', () => {
    expect(readAoSettings({ source: 'albedo' }).source).toBeUndefined();
    expect(aoValuesFor(readAoSettings({ height: 5 } as never), 'height')).toEqual(createDefaultAoValues('height'));
  });

  it('R43 saving keeps the other source\'s values and records the source used', () => {
    const before = { source: 'height', height: { depth: 3, strength: 1, spread: 40 }, normal: { spread: 20, power: 1, bias: 0 } };
    const after = writeAoSettings(before, 'normal', { spread: 30, power: 2, bias: 0.1 });
    expect(after).toEqual({ source: 'normal', height: before.height, normal: { spread: 30, power: 2, bias: 0.1 } });
    expect(before.normal.spread).toBe(20); // the record it came from is not changed
  });

  it('R43 saving into a record that had nothing creates the object', () => {
    expect(writeAoSettings(undefined, 'height', { depth: 2, strength: 1, spread: 40 })).toEqual({ source: 'height', height: { depth: 2, strength: 1, spread: 40 } });
  });
});
