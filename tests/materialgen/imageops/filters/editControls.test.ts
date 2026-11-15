import { describe, expect, it } from 'vitest';
import {
  EDIT_CATEGORIES, EDIT_MAP_KINDS, clampEditValue, controlsFor, createDefaultEditValues, editKindOf, hasAnyChanges, type EditMapKind,
} from '../../../../src/materialgen/imageops/filters/editControls';

const idsFor = (kind: EditMapKind): string[] => controlsFor(kind).map((control) => control.id);

describe('imageops edit controls (R14)', () => {
  it('R14 albedo has the tone, colour, detail (no highpass), surface levels and structure remap controls', () => {
    const ids = idsFor('albedo');
    expect(ids).toEqual(expect.arrayContaining(['exposure', 'highlights', 'shadows', 'hue', 'vibrance', 'sharpness', 'blur', 'clarity', 'denoise', 'levelsMin', 'levelsMid', 'levelsMax', 'histogramRemap']));
    for (const absent of ['highpass', 'invert', 'normalize', 'heightIntensity', 'roughnessBias', 'metallicBias', 'contrastLow', 'edgeEmphasis']) expect(ids).not.toContain(absent);
  });

  it('R14 rough, metal, ao and height have no highlights, shadows or colour; each adds its own bias or intensity', () => {
    for (const kind of ['rough', 'metal', 'ao', 'height'] as const) {
      const ids = idsFor(kind);
      for (const absent of ['highlights', 'shadows', 'hue', 'saturation', 'chroma', 'temperature', 'tint', 'vibrance']) expect(ids).not.toContain(absent);
      expect(ids).toEqual(expect.arrayContaining(['highpass', 'invert', 'normalize', 'contrastLow', 'contrastMid', 'contrastHigh']));
    }
    expect(idsFor('rough')).toContain('roughnessBias');
    expect(idsFor('metal')).toContain('metallicBias');
    expect(idsFor('height')).toEqual(expect.arrayContaining(['heightIntensity', 'edgeEmphasis']));
    expect(idsFor('ao')).not.toContain('heightIntensity');
  });

  it('R14 R82 a normal map has denoise and the colour mixin, both in Detail, the mixin 0..8 from 0', () => {
    expect(idsFor('normal')).toEqual(['denoise', 'albedoMix']);
    const mixin = controlsFor('normal').find((control) => control.id === 'albedoMix')!;
    expect([mixin.label, mixin.category, mixin.min, mixin.max, mixin.step, mixin.defaultValue]).toEqual(['Colour mixin', 'detail', 0, 8, 0.05, 0]);
  });

  it('R82 no other map kind has the colour mixin', () => {
    for (const kind of ['albedo', 'rough', 'metal', 'ao', 'height'] as const) expect(idsFor(kind)).not.toContain('albedoMix');
  });

  it('R14 ranges, steps and defaults match the table', () => {
    const byId = (id: string) => controlsFor('albedo').find((control) => control.id === id)!;
    expect(byId('exposure')).toMatchObject({ min: -3, max: 3, step: 0.01, defaultValue: 0 });
    expect(byId('contrast')).toMatchObject({ min: 0.25, max: 4, defaultValue: 1 });
    expect(byId('hue')).toMatchObject({ min: -180, max: 180, step: 1, defaultValue: 0 });
    expect(byId('sharpness')).toMatchObject({ min: 0, max: 2, step: 0.05 });
    expect(byId('blur')).toMatchObject({ min: 0, max: 10, step: 0.1 });
    expect(byId('levelsMid')).toMatchObject({ min: 0.1, max: 10, defaultValue: 1 });
    expect(byId('gamma')).toMatchObject({ min: 0.2, max: 5, defaultValue: 1 });
    expect(controlsFor('rough').find((control) => control.id === 'contrastLow')).toMatchObject({ min: 0, max: 4, defaultValue: 1, step: 0.1 });
    expect(controlsFor('rough').find((control) => control.id === 'invert')?.kind).toBe('toggle');
  });

  it('R17 categories come in a fixed order and only those the map kind has', () => {
    expect(EDIT_CATEGORIES).toEqual(['tone', 'color', 'detail', 'surface', 'structure']);
    const categoriesOf = (kind: EditMapKind) => [...new Set(controlsFor(kind).map((control) => control.category))];
    expect(categoriesOf('albedo')).toEqual(['tone', 'color', 'detail', 'surface', 'structure']);
    expect(categoriesOf('rough')).toEqual(['tone', 'detail', 'surface', 'structure']);
    expect(categoriesOf('normal')).toEqual(['detail']);
  });

  it('R16 the defaults are the table defaults and report no change', () => {
    for (const kind of EDIT_MAP_KINDS) {
      const values = createDefaultEditValues(kind);
      expect(hasAnyChanges(kind, values)).toBe(false);
      for (const control of controlsFor(kind)) expect(values[control.id]).toBe(control.defaultValue);
    }
  });

  it('R16 any shown control away from its default is a change; a control the map does not show is ignored', () => {
    const values = createDefaultEditValues('albedo');
    expect(hasAnyChanges('albedo', { ...values, hue: 1 })).toBe(true);
    expect(hasAnyChanges('albedo', { ...values, invert: 1 })).toBe(false); // albedo has no invert
    expect(hasAnyChanges('rough', { ...createDefaultEditValues('rough'), invert: 1 })).toBe(true);
    expect(hasAnyChanges('normal', { ...createDefaultEditValues('normal'), denoise: 0.1 })).toBe(true);
    expect(hasAnyChanges('normal', { ...createDefaultEditValues('normal'), albedoMix: 0.5 })).toBe(true);
  });

  it('R16 values outside a range are clamped to it', () => {
    expect(clampEditValue('albedo', 'exposure', 9)).toBe(3);
    expect(clampEditValue('albedo', 'exposure', -9)).toBe(-3);
    expect(clampEditValue('albedo', 'exposure', 1.5)).toBe(1.5);
    expect(clampEditValue('albedo', 'exposure', Number.NaN)).toBe(0);
  });

  it('R14 a diffuse map is edited as albedo and labels cannot be edited', () => {
    expect(editKindOf('diffuse')).toBe('albedo');
    expect(editKindOf('rough')).toBe('rough');
    expect(editKindOf('labels')).toBeNull();
  });
});
