import { describe, expect, it } from 'vitest';
import { buildMaterialJson, exportScriptFor, planExport, type ExportOptions, type ExportTarget } from '@mat/export';
import type { MapRecord, MapsState } from '@mat/maps';

const record = (key: string): MapRecord => ({ originalKey: key, workingKey: key, undoKey: null, width: 1024, height: 1024 });
const state: MapsState = { size: 1024, maps: { albedo: record('a'), normal: record('n'), height: record('h'), rough: record('r'), metal: record('m'), ao: record('o') } };
const options = (target: ExportTarget): ExportOptions => ({ target, packing: 'separate', includeHeight: true, includeAo: true, includeMasks: false, size: 1024 });
const sidecar = (target: ExportTarget): Record<string, unknown> => {
  const plan = planExport({ projectName: 'x', colorMode: 'albedo', state, hasMasks: false }, options(target));
  return buildMaterialJson({ plan, options: options(target), projectName: 'x', colorMode: 'albedo', preview: { tilingX: 1, tilingY: 1, heightScale: 0.02, heightLevel: 0.5 }, app: { name: 'a', version: '0' }, now: () => '2026-11-10T00:00:00.000Z' }) as unknown as Record<string, unknown>;
};

/** The sidecar keys a script reads: `info["key"]` and `info.get("key"`. */
const keysRead = (text: string): string[] => [...text.matchAll(/info(?:\["(\w+)"\]|\.get\("(\w+)")/g)].map((match) => (match[1] ?? match[2])!);

describe('materialgen/export R14 R17 which target gets which script', () => {
  it('R14 R17 Blender gets build_material.py and Maya gets import_material.py', () => {
    expect(exportScriptFor('blender')?.fileName).toBe('build_material.py');
    expect(exportScriptFor('maya')?.fileName).toBe('import_material.py');
  });

  it('R14 R17 Substance Painter and generic get no script', () => {
    expect(exportScriptFor('substance')).toBeNull();
    expect(exportScriptFor('generic')).toBeNull();
  });
});

describe('materialgen/export R14 R17 R19 the scripts read material.json', () => {
  it.each(['blender', 'maya'] as const)('R14 R17 the %s script names material.json and stops with its path when it is missing', (target) => {
    const text = exportScriptFor(target)!.text;
    expect(text).toContain('material.json');
    expect(text).toMatch(/Expected at/);
  });

  it.each(['blender', 'maya'] as const)('R19 the %s script reads only sidecar fields that material.json carries', (target) => {
    const carried = Object.keys(sidecar(target));
    const read = keysRead(exportScriptFor(target)!.text);
    expect(read.length).toBeGreaterThan(3);
    expect(read.filter((key) => !carried.includes(key))).toEqual([]);
  });

  it.each(['blender', 'maya'] as const)('R19 the %s script is fixed text: no template holes and no project value', (target) => {
    const text = exportScriptFor(target)!.text;
    expect(text).not.toMatch(/\$\{|undefined|\[object/);
    expect(text).not.toContain('Mossy bricks'); // the script takes no project name, so none can appear in it
    expect(exportScriptFor(target)!.text).toBe(text);
  });
});

describe('materialgen/export R15 R16 Blender wiring', () => {
  const text = exportScriptFor('blender')!.text;

  it('R15 R16 builds the node chain the spec lists', () => {
    for (const node of ['ShaderNodeBsdfPrincipled', 'ShaderNodeOutputMaterial', 'ShaderNodeTexCoord', 'ShaderNodeMapping', 'ShaderNodeTexImage', 'ShaderNodeNormalMap', 'ShaderNodeDisplacement']) expect(text).toContain(node);
  });

  it('R16 uses the Mix node when it exists and falls back to MixRGB, both multiplying', () => {
    expect(text).toContain('ShaderNodeMix');
    expect(text).toContain('ShaderNodeMixRGB');
    expect(text).toContain('MULTIPLY');
  });

  it('R16 uses a Separate Color node for the packed map', () => {
    expect(text).toContain('ShaderNodeSeparateColor');
  });

  it('R16 wires the sockets and settings the spec lists: base colour, roughness, metallic, normal, displacement scale and midlevel, and Non-Color data maps', () => {
    for (const token of ['Base Color', 'Roughness', 'Metallic', 'Scale', 'Midlevel', 'displacement_method', 'Non-Color']) expect(text, token).toContain(token);
  });

  it('R15 never deletes an existing material', () => {
    expect(text).not.toMatch(/materials\.remove|bpy\.ops\.object\.delete|bpy\.data\.materials\[/);
  });
});

describe('materialgen/export R18 Maya wiring', () => {
  const text = exportScriptFor('maya')!.text;

  it('R17 loads mtoa and stops with a message when Arnold cannot be used', () => {
    expect(text).toContain('mtoa');
    expect(text).toMatch(/Arnold/);
  });

  it('R18 builds the Arnold nodes the spec lists', () => {
    for (const node of ['aiStandardSurface', 'place2dTexture', 'aiMultiply', 'aiNormalMap', 'displacementShader']) expect(text).toContain(node);
  });

  it('R18 sets the tiling and the attribute names the spec lists: repeatU, repeatV, baseColor, specularRoughness, metalness, normalCamera, and a raw colour space for data maps', () => {
    for (const token of ['repeatU', 'repeatV', 'baseColor', 'specularRoughness', 'metalness', 'normalCamera', 'colorSpace']) expect(text, token).toContain(token);
  });

  it('R12 R18 turns the Y inversion on for DirectX normals, from the sidecar', () => {
    expect(text).toContain('invertY');
    expect(text).toContain('normalConvention');
  });
});
