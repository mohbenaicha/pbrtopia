import { describe, expect, it } from 'vitest';
import { buildMaterialJson, exportSizeChoices, normalConventionFor, planExport, type ExportOptions } from '@mat/export';
import type { MapRecord, MapsState } from '@mat/maps';

const map = (key: string, extra: Partial<MapRecord> = {}): MapRecord => ({ originalKey: key, workingKey: key, undoKey: null, width: 1024, height: 1024, ...extra });
const full = (): MapsState => ({
  size: 1024,
  maps: {
    albedo: map('a'), normal: map('n'), height: map('h'), rough: map('r'), metal: map('m'), ao: map('o'),
    labels: map('l', { derivedFrom: { kind: 'albedo', key: 'a' } }),
  },
});
const options = (patch: Partial<ExportOptions> = {}): ExportOptions => ({ target: 'blender', packing: 'separate', includeHeight: true, includeAo: true, includeMasks: false, size: 1024, ...patch });
const input = (state: MapsState, colorMode: 'albedo' | 'diffuse' = 'albedo') => ({ projectName: 'Mossy bricks', colorMode, state, hasMasks: true });
const names = (plan: ReturnType<typeof planExport>): string[] => plan.files.map((file) => file.fileName);

describe('materialgen/export R9 R21 files to write', () => {
  it('R9 separate mode writes one file per present map, in the fixed order', () => {
    expect(names(planExport(input(full()), options()))).toEqual(['albedo.png', 'normal.png', 'height.png', 'roughness.png', 'metallic.png', 'ao.png']);
  });

  it('R9 R24 an absent map gets no file, no placeholder, and is listed as missing', () => {
    const state = full();
    delete state.maps.normal;
    delete state.maps.metal;
    const plan = planExport(input(state), options());
    expect(names(plan)).not.toContain('normal.png');
    expect(plan.missing).toEqual(['normal', 'metallic']);
  });

  it('R3 the colour map is diffuse.png in diffuse mode', () => {
    expect(names(planExport(input(full(), 'diffuse'), options()))[0]).toBe('diffuse.png');
  });

  it('R21 Include height off leaves height out and does not count it as missing', () => {
    const plan = planExport(input(full()), options({ includeHeight: false }));
    expect(names(plan)).not.toContain('height.png');
    expect(plan.missing).toEqual([]);
  });

  it('R21 Include ambient occlusion off leaves ao out of the separate files', () => {
    expect(names(planExport(input(full()), options({ includeAo: false })))).not.toContain('ao.png');
  });

  it('R8 packed mode writes albedo, normal, height and one orm.png and none of the three packed maps', () => {
    expect(names(planExport(input(full()), options({ packing: 'packed' })))).toEqual(['albedo.png', 'normal.png', 'height.png', 'orm.png']);
  });

  it('R8 packed mode with ao excluded still packs roughness and metallic (ao becomes 255)', () => {
    const plan = planExport(input(full()), options({ packing: 'packed', includeAo: false }));
    expect(names(plan)).toContain('orm.png');
    expect(plan.orm).toEqual({ ao: false, rough: true, metal: true });
  });

  it('R8 packed mode with ao, roughness and metallic all missing or excluded lists no orm.png', () => {
    const state = full();
    delete state.maps.rough;
    delete state.maps.metal;
    expect(names(planExport(input(state), options({ packing: 'packed', includeAo: false })))).not.toContain('orm.png');
  });

  it('R8 packed mode with only roughness present lists orm.png and no roughness.png', () => {
    const state: MapsState = { size: 1024, maps: { rough: map('r') } };
    const plan = planExport(input(state), options({ packing: 'packed' }));
    expect(names(plan)).toEqual(['orm.png']);
    expect(plan.orm).toEqual({ ao: false, rough: true, metal: false });
  });

  it('R4 Substance Painter names carry the sanitised project name', () => {
    expect(names(planExport(input(full()), options({ target: 'substance' })))[0]).toBe('Mossy bricks_BaseColor.png');
  });

  it('R22 every listed file carries the size it will be written at', () => {
    expect(planExport(input(full()), options({ size: 512 })).files.every((file) => file.sizePx === 512)).toBe(true);
  });
});

describe('materialgen/export R23 R27 R28 extras, stale maps and warnings', () => {
  it('R23 Include material masks adds labels and masks.json (Substance: _Labels, _Masks), after the maps', () => {
    expect(names(planExport(input(full()), options({ includeMasks: true }))).slice(-2)).toEqual(['labels.png', 'masks.json']);
    expect(names(planExport(input(full()), options({ includeMasks: true, target: 'substance' }))).slice(-2)).toEqual(['Mossy bricks_Labels.png', 'Mossy bricks_Masks.json']);
  });

  it('R23 masks are not listed when the labels or the masks record are missing', () => {
    const state = full();
    delete state.maps.labels;
    expect(names(planExport(input(state), options({ includeMasks: true })))).not.toContain('labels.png');
    expect(names(planExport({ ...input(full()), hasMasks: false }, options({ includeMasks: true })))).not.toContain('masks.json');
  });

  it('R27 a derived map whose source changed is written and listed as stale', () => {
    const state = full();
    state.maps.ao = map('o', { derivedFrom: { kind: 'height', key: 'older' } });
    const plan = planExport(input(state), options());
    expect(names(plan)).toContain('ao.png');
    expect(plan.stale).toEqual(['ao']);
  });

  it('R28 no albedo with other maps present gives the warning, and the export is allowed', () => {
    const state = full();
    delete state.maps.albedo;
    const plan = planExport(input(state), options());
    expect(plan.warnings).toContain('No albedo: the script builds the material without base colour');
    expect(plan.files.length).toBeGreaterThan(0);
  });

  it('R36 no map at all gives an empty list', () => {
    expect(planExport(input({ size: null, maps: {} }), options()).files).toEqual([]);
  });
});

describe('materialgen/export R22 sizes', () => {
  it('R22 the choices are S and every smaller size, never a larger one', () => {
    expect(exportSizeChoices(1024)).toEqual([1024, 512, 256]);
    expect(exportSizeChoices(256)).toEqual([256]);
    expect(exportSizeChoices(2048)).toEqual([2048, 1024, 512, 256]);
  });
});

describe('materialgen/export R10 R12 R13 material.json', () => {
  const clock = () => '2026-11-10T12:00:00.000Z';
  const preview = { tilingX: 2, tilingY: 3, heightScale: 0.05, heightLevel: 0.4, heightContrast: 1 };
  const build = (patch: Partial<ExportOptions> = {}, colorMode: 'albedo' | 'diffuse' = 'albedo') => {
    const plan = planExport(input(full(), colorMode), options(patch));
    return buildMaterialJson({ plan, options: options(patch), projectName: 'Mossy "bricks"', colorMode, preview, app: { name: 'material-lab', version: '0.0.0' }, now: clock });
  };

  it('R10 carries every field of the sidecar', () => {
    const json = build();
    expect(json).toMatchObject({
      schema: 1, target: 'blender', projectName: 'Mossy "bricks"', name: 'Mossy bricks', appName: 'material-lab', appVersion: '0.0.0', exportedAt: clock(),
      size: 1024, colorMode: 'albedo', normalConvention: 'opengl', packing: 'separate', heightScale: 0.05, heightMidlevel: 0.4, tiling: { x: 2, y: 3 }, missing: [], stale: [],
    });
    expect(json.colorSpaces).toMatchObject({ albedo: 'sRGB', normal: 'Non-Color', roughness: 'Non-Color' });
    expect(json.files).toMatchObject({ albedo: 'albedo.png', roughness: 'roughness.png', ao: 'ao.png' });
  });

  it('R10 files lists only what is written, and orm replaces the three packed maps', () => {
    const files = build({ packing: 'packed' }).files;
    expect(Object.keys(files)).toEqual(['albedo', 'normal', 'height', 'orm']);
  });

  it('R10 colour mode diffuse is recorded and its file is diffuse.png under the key albedo', () => {
    const json = build({}, 'diffuse');
    expect(json.colorMode).toBe('diffuse');
    expect(json.files['albedo']).toBe('diffuse.png');
  });

  it('R12 R13 the normal convention follows the target', () => {
    expect(normalConventionFor('blender')).toBe('opengl');
    expect(normalConventionFor('maya')).toBe('directx');
    expect(normalConventionFor('substance')).toBe('directx');
    expect(normalConventionFor('generic')).toBe('opengl');
    expect(build({ target: 'maya' }).normalConvention).toBe('directx');
  });

  it('R22 the written size is the chosen size', () => {
    expect(build({ size: 512 }).size).toBe(512);
  });

  it('R23 the extras appear only when written', () => {
    expect(build().labels).toBeUndefined();
    const json = build({ includeMasks: true });
    expect(json.labels).toBe('labels.png');
    expect(json.masks).toBe('masks.json');
  });

  it('R10 the date comes from the injected clock', () => {
    expect(build().exportedAt).toBe('2026-11-10T12:00:00.000Z');
  });
});
