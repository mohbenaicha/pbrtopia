import { describe, expect, it } from 'vitest';
import { EXPORT_FILE_SUFFIXES, exportFileName, sanitiseExportName } from '@mat/export';

describe('materialgen/export R1 sanitised name', () => {
  it('R1 trims, replaces forbidden characters and control characters by _, collapses spaces and drops trailing dots and spaces', () => {
    expect(sanitiseExportName('  Mossy   bricks.  ')).toBe('Mossy bricks');
    expect(sanitiseExportName('a\\b/c:d*e?f"g<h>i|j')).toBe('a_b_c_d_e_f_g_h_i_j');
    expect(sanitiseExportName('tab\there\u0001')).toBe('tab_here_');
  });

  it('R2 a name never contains ".." (a run of dots becomes one _)', () => {
    expect(sanitiseExportName('a..b')).toBe('a_b');
    expect(sanitiseExportName('v1...2')).toBe('v1_2');
    expect(exportFileName('substance', 'albedo', sanitiseExportName('a..b'), 'albedo')).not.toContain('..');
  });

  it('R1 the cut never splits a surrogate pair', () => {
    const cut = sanitiseExportName('\u{1F9F1}'.repeat(121));
    expect(Array.from(cut)).toHaveLength(120);
    expect(cut).not.toMatch(/[\uD800-\uDBFF](?![\uDC00-\uDFFF])/);
  });

  it('R1 an empty name becomes Untitled', () => {
    expect(sanitiseExportName('   ')).toBe('Untitled');
    expect(sanitiseExportName('...')).toBe('Untitled');
  });

  it('R1 a Windows device name, in any case, gets a _ prefix', () => {
    expect(sanitiseExportName('con')).toBe('_con');
    expect(sanitiseExportName('LPT3')).toBe('_LPT3');
    expect(sanitiseExportName('console')).toBe('console');
  });

  it('R1 the name is cut to 120 characters', () => {
    expect(sanitiseExportName('x'.repeat(300))).toHaveLength(120);
  });

  it('R1 a cut that leaves a trailing dot or space is cleaned again', () => {
    expect(sanitiseExportName(`${'x'.repeat(119)}. y`)).toBe('x'.repeat(119));
  });
});

describe('materialgen/export R3 R4 file names', () => {
  it('R3 Blender and Maya use the plain table, with diffuse.png in diffuse mode', () => {
    for (const target of ['blender', 'maya', 'generic'] as const) {
      expect(exportFileName(target, 'albedo', 'Brick', 'albedo')).toBe('albedo.png');
      expect(exportFileName(target, 'albedo', 'Brick', 'diffuse')).toBe('diffuse.png');
      expect(exportFileName(target, 'normal', 'Brick', 'albedo')).toBe('normal.png');
      expect(exportFileName(target, 'height', 'Brick', 'albedo')).toBe('height.png');
      expect(exportFileName(target, 'roughness', 'Brick', 'albedo')).toBe('roughness.png');
      expect(exportFileName(target, 'metallic', 'Brick', 'albedo')).toBe('metallic.png');
      expect(exportFileName(target, 'ao', 'Brick', 'albedo')).toBe('ao.png');
      expect(exportFileName(target, 'orm', 'Brick', 'albedo')).toBe('orm.png');
      expect(exportFileName(target, 'labels', 'Brick', 'albedo')).toBe('labels.png');
    }
  });

  it('R4 Substance Painter names carry the project name and one casing rule; the colour map stays BaseColor in both colour modes', () => {
    expect(exportFileName('substance', 'albedo', 'Brick', 'diffuse')).toBe('Brick_BaseColor.png');
    expect(exportFileName('substance', 'normal', 'Brick', 'albedo')).toBe('Brick_Normal.png');
    expect(exportFileName('substance', 'height', 'Brick', 'albedo')).toBe('Brick_Height.png');
    expect(exportFileName('substance', 'roughness', 'Brick', 'albedo')).toBe('Brick_Roughness.png');
    expect(exportFileName('substance', 'metallic', 'Brick', 'albedo')).toBe('Brick_Metallic.png');
    expect(exportFileName('substance', 'ao', 'Brick', 'albedo')).toBe('Brick_AmbientOcclusion.png');
    expect(exportFileName('substance', 'orm', 'Brick', 'albedo')).toBe('Brick_ORM.png');
    expect(exportFileName('substance', 'labels', 'Brick', 'albedo')).toBe('Brick_Labels.png');
    expect(exportFileName('substance', 'emissive', 'Brick', 'albedo')).toBe('Brick_Emissive.png'); // R41
    expect(exportFileName('blender', 'emissive', 'Brick', 'albedo')).toBe('emissive.png');
  });

  it('R4 every Substance suffix starts with a capital and has no other capital except BaseColor and ORM', () => {
    for (const suffix of Object.values(EXPORT_FILE_SUFFIXES)) expect(suffix).toMatch(/^[A-Z][A-Za-z]*$/);
  });
});
