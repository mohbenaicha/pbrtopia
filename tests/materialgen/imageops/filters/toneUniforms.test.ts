import { describe, expect, it } from 'vitest';
import { createDefaultEditValues } from '../../../../src/materialgen/imageops/filters/editControls';
import { buildToneUniforms } from '../../../../src/materialgen/imageops/filters/toneUniforms';

const RANGE = { min: 0.2, max: 0.7 };

describe('imageops tone uniforms (R15, R20)', () => {
  it('R15 the defaults of every kind give the identity uniforms the shader guards test against', () => {
    for (const kind of ['albedo', 'rough', 'metal', 'ao', 'height', 'normal'] as const) {
      const u = buildToneUniforms(kind, createDefaultEditValues(kind), RANGE);
      expect(u.normalizeRange).toEqual([0, 0]);
      expect(u.levels).toEqual([0, 1, 1]);
      expect(u.exposure).toEqual([0, 0, 1, 1]);
      expect(u.tone).toEqual([0, 0, 0, 0]);
      expect(u.shape).toEqual([1, 1, 0, 0]);
      expect(u.colorA).toEqual([1, 0, 1, 0]);
      expect(u.colorB).toEqual([0, 0]);
    }
  });

  it('R20 Normalise passes the measured range only while it is on', () => {
    expect(buildToneUniforms('rough', { ...createDefaultEditValues('rough'), normalize: 1 }, RANGE).normalizeRange).toEqual([0.2, 0.7]);
  });

  it('R20 Normalise with min = max changes nothing', () => {
    expect(buildToneUniforms('rough', { ...createDefaultEditValues('rough'), normalize: 1 }, { min: 0.4, max: 0.4 }).normalizeRange).toEqual([0, 0]);
  });

  it('R14 values the map kind does not show are ignored', () => {
    const u = buildToneUniforms('rough', { ...createDefaultEditValues('rough'), hue: 90, highlights: 1, invert: 1 }, RANGE);
    expect(u.colorA).toEqual([1, 0, 1, 0]);
    expect(u.tone[0]).toBe(0);
    expect(u.shape[3]).toBe(1); // invert is shown for rough
  });

  it('R14 the bias belongs to its own map kind', () => {
    const rough = buildToneUniforms('rough', { ...createDefaultEditValues('rough'), roughnessBias: 0.2, metallicBias: 0.3 }, RANGE);
    expect(rough.shape[2]).toBe(0.2);
    const metal = buildToneUniforms('metal', { ...createDefaultEditValues('metal'), roughnessBias: 0.2, metallicBias: 0.3 }, RANGE);
    expect(metal.shape[2]).toBe(0.3);
  });

  it('R4 only albedo is encoded to sRGB and only the grey maps are filtered as one channel (R23)', () => {
    expect(buildToneUniforms('albedo', createDefaultEditValues('albedo'), RANGE)).toMatchObject({ albedo: true, grey: false });
    expect(buildToneUniforms('normal', createDefaultEditValues('normal'), RANGE)).toMatchObject({ albedo: false, grey: false });
    expect(buildToneUniforms('height', createDefaultEditValues('height'), RANGE)).toMatchObject({ albedo: false, grey: true });
  });
});
