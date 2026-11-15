import { describe, expect, it } from 'vitest';
import { DEFAULT_BRUSH } from '../../../../src/materialgen/compositing/plan/brushParams';
import { paintSettingsOf } from '../../../../src/materialgen/compositing/session/paintSettings';

const material = { albedo: [1, 2, 3] as const, roughness: 4, metalness: 5 };

describe('materialgen/compositing paint settings (R17 R18 R19)', () => {
  it('R18 with the Height switch off nothing is written to height; Edge burn off writes no normal', () => {
    expect(paintSettingsOf(DEFAULT_BRUSH, material)).toEqual({ material, height: null, edgeBurn: null });
  });

  it('R18 replace paints 0.5 + level / 2, additive level / 2 (signed)', () => {
    const on = { ...DEFAULT_BRUSH.height, on: true };
    expect(paintSettingsOf({ ...DEFAULT_BRUSH, height: { ...on, level: 0.6 } }, material).height).toEqual({ mode: 'replace', value: 0.8 });
    expect(paintSettingsOf({ ...DEFAULT_BRUSH, height: { ...on, level: -0.4, additive: true } }, material).height).toEqual({ mode: 'add', value: -0.2 });
  });

  it('R19 R77 Edge burn carries its direction and its width, and is null while it is off', () => {
    expect(paintSettingsOf({ ...DEFAULT_BRUSH, edgeBurn: { on: true, direction: 'dent', width: 7 } }, material).edgeBurn).toEqual({ direction: 'dent', width: 7 });
    expect(paintSettingsOf({ ...DEFAULT_BRUSH, edgeBurn: { on: false, direction: 'dent', width: 7 } }, material).edgeBurn).toBeNull();
  });
});
