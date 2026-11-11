import { describe, expect, it } from 'vitest';
import { EXPORT_TARGET_CARDS, exportProgressText, exportSuccessMessage, loadLastExportTarget, saveLastExportTarget } from '@mat/export';

const memory = (initial: Record<string, string> = {}) => {
  const values = { ...initial };
  return { getItem: (key: string) => values[key] ?? null, setItem: (key: string, value: string) => void (values[key] = value) };
};

describe('materialgen/export R20 target cards', () => {
  it('R20 there are three cards, Blender, Maya and Substance 3D Painter, in that order', () => {
    expect(EXPORT_TARGET_CARDS.map((card) => [card.target, card.title])).toEqual([['blender', 'Blender'], ['maya', 'Maya'], ['substance', 'Substance 3D Painter']]);
  });

  it('R20 each card says how to bring the files in', () => {
    const text = (target: string) => EXPORT_TARGET_CARDS.find((card) => card.target === target)!.instructions;
    expect(text('blender')).toMatch(/Scripting.*build_material\.py/s);
    expect(text('maya')).toMatch(/Script Editor.*import_material\.py/s);
    expect(text('substance')).toMatch(/layer stack.*texture/s);
  });

  it('R13 each card names the normal convention it writes', () => {
    expect(EXPORT_TARGET_CARDS.map((card) => card.convention)).toEqual(['OpenGL normals', 'DirectX normals (green flipped)', 'DirectX normals (green flipped)']);
  });
});

describe('materialgen/export R33 R34 messages', () => {
  it('R33 the progress reads "Encoding normal, 3 of 6"', () => {
    expect(exportProgressText({ text: 'Encoding normal', done: 3, total: 6 })).toBe('Encoding normal, 3 of 6');
    expect(exportProgressText({ text: 'Packing the zip', done: 6, total: 6 })).toBe('Packing the zip, 6 of 6');
  });

  it('R34 the success message gives the name and the size in MB to one decimal place', () => {
    expect(exportSuccessMessage('Mossy bricks.zip', 1_572_864)).toBe('Exported Mossy bricks.zip (1.5 MB)');
    expect(exportSuccessMessage('Tile.zip', 10)).toBe('Exported Tile.zip (0.0 MB)');
  });
});

describe('materialgen/export R20 the last used target', () => {
  it('R20 defaults to Blender when nothing or something unknown is stored', () => {
    expect(loadLastExportTarget(memory())).toBe('blender');
    expect(loadLastExportTarget(memory({ 'material-lab.export.target': 'generic' }))).toBe('blender');
  });

  it('R20 remembers the last target that was exported', () => {
    const storage = memory();
    saveLastExportTarget(storage, 'maya');
    expect(loadLastExportTarget(storage)).toBe('maya');
  });

  it('R20 a storage that throws never breaks the dialog', () => {
    const broken = { getItem: () => { throw new Error('blocked'); }, setItem: () => { throw new Error('blocked'); } };
    expect(loadLastExportTarget(broken)).toBe('blender');
    expect(() => saveLastExportTarget(broken, 'maya')).not.toThrow();
  });
});
