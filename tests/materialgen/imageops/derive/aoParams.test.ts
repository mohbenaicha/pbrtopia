import { describe, expect, it } from 'vitest';
import { aoControlsFor, aoSourceFor, createDefaultAoValues, hasAoChanges } from '../../../../src/materialgen/imageops/derive/aoParams';

describe('imageops AO parameters (R41-R43)', () => {
  it('R41 AO from height has Depth 0.1..12 (2.4), Strength 0.6..1.8 (0.96) and Spread 8..80 (40)', () => {
    const byId = (id: string) => aoControlsFor('height').find((control) => control.id === id)!;
    expect(aoControlsFor('height').map((control) => control.id)).toEqual(['depth', 'strength', 'spread']);
    expect(byId('depth')).toMatchObject({ min: 0.1, max: 12, defaultValue: 2.4 });
    expect(byId('strength')).toMatchObject({ min: 0.6, max: 1.8, defaultValue: 0.96 });
    expect(byId('spread')).toMatchObject({ min: 8, max: 80, defaultValue: 40 });
  });

  it('R42 AO from normal has Spread 8..80 (50), Power 0.25..4 (1) and Bias -0.5..0.5 (0)', () => {
    const byId = (id: string) => aoControlsFor('normal').find((control) => control.id === id)!;
    expect(aoControlsFor('normal').map((control) => control.id)).toEqual(['spread', 'power', 'bias']);
    expect(byId('spread')).toMatchObject({ min: 8, max: 80, defaultValue: 50 });
    expect(byId('power')).toMatchObject({ min: 0.25, max: 4, defaultValue: 1 });
    expect(byId('bias')).toMatchObject({ min: -0.5, max: 0.5, defaultValue: 0 });
  });

  it('R43 the defaults are the table defaults and report no change', () => {
    expect(createDefaultAoValues('height')).toEqual({ depth: 2.4, strength: 0.96, spread: 40 });
    expect(hasAoChanges('height', createDefaultAoValues('height'))).toBe(false);
    expect(hasAoChanges('normal', { ...createDefaultAoValues('normal'), power: 2 })).toBe(true);
  });

  it('R42 the source is the height map by default, the normal map when there is no height, and null with neither', () => {
    expect(aoSourceFor({ hasHeight: true, hasNormal: true }, undefined)).toBe('height');
    expect(aoSourceFor({ hasHeight: true, hasNormal: true }, 'normal')).toBe('normal');
    expect(aoSourceFor({ hasHeight: false, hasNormal: true }, 'height')).toBe('normal');
    expect(aoSourceFor({ hasHeight: true, hasNormal: false }, 'normal')).toBe('height');
    expect(aoSourceFor({ hasHeight: false, hasNormal: false }, undefined)).toBeNull();
  });
});
