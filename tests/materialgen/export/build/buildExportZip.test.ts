import { unzipSync } from 'fflate';
import { describe, expect, it, vi } from 'vitest';
import { buildExportZip, planExport, type BuildExportInput, type ExportOptions } from '@mat/export';
import type { MapKind, MapRecord, MapsState, PixelImage } from '@mat/maps';
import { decodePng } from '@mat/maps/png/pngCodec';
import type { MasksRecord } from '@mat/masks';

const record = (key: string): MapRecord => ({ originalKey: key, workingKey: key, undoKey: null, width: 4, height: 4 });
const state = (): MapsState => ({ size: 4 as unknown as MapsState['size'], maps: { albedo: record('a'), normal: record('n'), height: record('h'), rough: record('r'), metal: record('m'), ao: record('o'), labels: record('l') } });
const filled = (channels: 1 | 3 | 4, value: (pixel: number, channel: number) => number): PixelImage => {
  const data = new Uint8Array(16 * channels);
  for (let pixel = 0; pixel < 16; pixel += 1) for (let c = 0; c < channels; c += 1) data[pixel * channels + c] = value(pixel, c);
  return { width: 4, height: 4, channels, data };
};
const pictures = (): Partial<Record<MapKind, PixelImage>> => ({
  albedo: filled(4, (p, c) => (c === 3 ? 255 : 10 + c)), // an RGBA picture: the file must still be RGB
  normal: filled(3, (_p, c) => [100, 200, 250][c]!),
  height: filled(3, (p) => p * 10), // a coloured picture in a grey slot: the file is grey
  rough: filled(1, () => 60),
  metal: filled(1, () => 5),
  ao: filled(1, () => 200),
  labels: filled(1, (p) => (p < 8 ? 0 : 1)),
});
const masksRecord = (): MasksRecord => ({
  source: 'model',
  palette: [{ label: 0, hex: '#FF0000', name: 'red' }, { label: 1, hex: '#00FF00', name: 'green' }],
  feather: 1,
  rows: [
    { label: 0, name: 'Wall', description: '', location: '', defaultMaterial: 'Brick', top3: [], matchKind: 'keyword', material: 'Brick', rough: 0.8, metal: 0 },
    { label: 1, name: 'Plate', description: '', location: '', defaultMaterial: 'Steel', top3: [], matchKind: 'keyword', material: 'Steel', rough: 0.3, metal: 1 },
  ],
});
const options = (patch: Partial<ExportOptions> = {}): ExportOptions => ({ target: 'blender', packing: 'separate', includeHeight: true, includeAo: true, includeMasks: false, size: 4, ...patch });
const clock = () => '2026-11-10T12:00:00.000Z';

function inputFor(patch: Partial<ExportOptions> = {}, extra: Partial<BuildExportInput> = {}, read?: BuildExportInput['readMap']): BuildExportInput {
  const chosen = options(patch);
  const maps = pictures();
  return {
    plan: planExport({ projectName: 'Mossy bricks', colorMode: 'albedo', state: state(), hasMasks: true }, chosen),
    options: chosen,
    projectName: 'Mossy bricks',
    colorMode: 'albedo',
    state: state(),
    preview: { tilingX: 1, tilingY: 1, heightScale: 0.02, heightLevel: 0.5 },
    masks: masksRecord(),
    app: { name: 'material-lab', version: '0.0.0' },
    now: clock,
    script: null,
    readMap: read ?? (async (kind) => maps[kind] ?? null),
    ...extra,
  };
}

const unzip = (bytes: Uint8Array): Record<string, Uint8Array> => unzipSync(bytes);
const png = (entry: Uint8Array | undefined): PixelImage => {
  const decoded = decodePng(entry!);
  if ('palette' in decoded) throw new Error('expected a non-indexed picture');
  return decoded;
};

describe('materialgen/export R31 zip order and names', () => {
  it('R31 R2 the entries are flat and in the fixed order: material.json, the maps, the extras, the script', async () => {
    const { bytes, fileName } = await buildExportZip(inputFor({ includeMasks: true }, { script: { fileName: 'build_material.py', text: '# script' } }));
    expect(fileName).toBe('Mossy bricks.zip');
    expect(Object.keys(unzip(bytes))).toEqual(['material.json', 'albedo.png', 'normal.png', 'height.png', 'roughness.png', 'metallic.png', 'ao.png', 'labels.png', 'masks.json', 'build_material.py']);
  });

  it('R2 no entry name has a folder or a parent reference, and none repeats without regard to case', async () => {
    const names = Object.keys(unzip((await buildExportZip(inputFor({ target: 'substance', includeMasks: true }))).bytes));
    expect(names.every((entry) => !/[\\/]|\.\./.test(entry))).toBe(true);
    expect(new Set(names.map((entry) => entry.toLowerCase())).size).toBe(names.length);
  });

  it('R31 the entry time is the export time', async () => {
    const { bytes } = await buildExportZip(inputFor());
    const first = unzip(bytes);
    expect(first['material.json']).toBeDefined();
    const again = await buildExportZip(inputFor());
    expect(Array.from(again.bytes)).toEqual(Array.from(bytes)); // the same input gives the same zip
  });

  it('R31 the entry time is the export time as written in UTC, whatever the time zone of the machine', async () => {
    const { bytes } = await buildExportZip(inputFor());
    const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
    expect(view.getUint16(10, true)).toBe(12 << 11); // 12:00:00 UTC in the DOS time field of the first entry
    expect(view.getUint16(12, true)).toBe(((2026 - 1980) << 9) | (11 << 5) | 10); // 2026-11-10
  });
});

describe('materialgen/export R6 R7 pixel formats', () => {
  it('R6 albedo and normal are RGB without alpha, height is grey, and values are written as stored', async () => {
    const files = unzip((await buildExportZip(inputFor())).bytes);
    const albedo = png(files['albedo.png']);
    expect([albedo.channels, albedo.width]).toEqual([3, 4]);
    expect(Array.from(albedo.data.slice(0, 3))).toEqual([10, 11, 12]);
    const normal = png(files['normal.png']);
    expect([normal.channels, Array.from(normal.data.slice(0, 3))]).toEqual([3, [100, 200, 250]]);
    const height = png(files['height.png']);
    expect([height.channels, height.data[1]]).toEqual([1, 10]);
    expect(png(files['roughness.png']).channels).toBe(1);
  });

  it('R25 a Blender export holds the same map bytes as the generic one', async () => {
    const generic = unzip((await buildExportZip(inputFor({ target: 'generic' }))).bytes);
    const blender = unzip((await buildExportZip(inputFor({ target: 'blender' }))).bytes);
    for (const name of Object.keys(generic).filter((entry) => entry.endsWith('.png'))) expect(Array.from(blender[name]!)).toEqual(Array.from(generic[name]!));
  });
});

describe('materialgen/export R11 R12 normal convention', () => {
  it('R12 Maya and Substance flip the green channel, Blender does not', async () => {
    const maya = png(unzip((await buildExportZip(inputFor({ target: 'maya' }))).bytes)['normal.png']);
    expect(Array.from(maya.data.slice(0, 3))).toEqual([100, 55, 250]);
    const substance = png(unzip((await buildExportZip(inputFor({ target: 'substance' }))).bytes)['Mossy bricks_Normal.png']);
    expect(Array.from(substance.data.slice(0, 3))).toEqual([100, 55, 250]);
    const blender = png(unzip((await buildExportZip(inputFor({ target: 'blender' }))).bytes)['normal.png']);
    expect(Array.from(blender.data.slice(0, 3))).toEqual([100, 200, 250]);
  });
});

describe('materialgen/export R8 R22 R23 content', () => {
  it('R8 the packed ORM holds ao, roughness and metallic in R, G and B', async () => {
    const files = unzip((await buildExportZip(inputFor({ packing: 'packed' }))).bytes);
    expect(Object.keys(files)).not.toContain('roughness.png');
    const orm = png(files['orm.png']);
    expect([orm.channels, Array.from(orm.data.slice(0, 3))]).toEqual([3, [200, 60, 5]]);
  });

  it('R22 a smaller size is written at that size, and the sidecar says so', async () => {
    const files = unzip((await buildExportZip(inputFor({ size: 2 }))).bytes);
    expect(png(files['albedo.png']).width).toBe(2);
    expect(JSON.parse(new TextDecoder().decode(files['material.json'])).size).toBe(2);
  });

  it('R23 labels are written in their palette colours and masks.json lists the rows as stored', async () => {
    const files = unzip((await buildExportZip(inputFor({ includeMasks: true }))).bytes);
    const labels = png(files['labels.png']);
    expect([labels.channels, Array.from(labels.data.slice(0, 3)), Array.from(labels.data.slice(-3))]).toEqual([3, [255, 0, 0], [0, 255, 0]]);
    const masks = JSON.parse(new TextDecoder().decode(files['masks.json']));
    expect(masks.labels[1]).toEqual({ index: 1, hex: '#00FF00', name: 'Plate', baseMaterial: 'Steel', roughness: 0.3, metal: 1 });
  });

  it('R22 a stored normal map with an alpha channel still exports at a smaller size', async () => {
    const maps = pictures();
    maps.normal = filled(4, (_p, c) => [100, 200, 250, 255][c]!);
    const files = unzip((await buildExportZip(inputFor({ size: 2 }, {}, async (kind) => maps[kind] ?? null))).bytes);
    expect(png(files['normal.png']).channels).toBe(3);
  });

  it('R10 material.json is 2-space indented UTF-8 with the unsanitised project name', async () => {
    const text = new TextDecoder().decode(unzip((await buildExportZip(inputFor({}, { projectName: 'Mossy "bricks" é' }))).bytes)['material.json']);
    expect(text).toContain('\n  "schema": 1');
    expect(JSON.parse(text).projectName).toBe('Mossy "bricks" é');
  });
});

describe('materialgen/export R29 R30 R33 reading, failure and cancel', () => {
  it('R30 a map that cannot be read fails the export and names the map; no zip is returned', async () => {
    const maps = pictures();
    await expect(buildExportZip(inputFor({}, {}, async (kind) => (kind === 'normal' ? null : maps[kind] ?? null)))).rejects.toThrow(/normal/i);
  });

  it('R29 only maps in the plan are read, once each', async () => {
    const maps = pictures();
    const read = vi.fn(async (kind: MapKind) => maps[kind] ?? null);
    await buildExportZip(inputFor({ includeHeight: false }, {}, read));
    const kinds = read.mock.calls.map(([kind]) => kind).sort();
    expect(kinds).toEqual(['albedo', 'ao', 'metal', 'normal', 'rough']);
  });

  it('R33 the progress names the step and counts the files', async () => {
    const steps: string[] = [];
    await buildExportZip(inputFor({}, { onProgress: (step) => steps.push(`${step.text} ${step.done}/${step.total}`) }));
    expect(steps[0]).toBe('Encoding albedo 1/6');
    expect(steps.at(-1)).toMatch(/^Packing the zip 6\/6$/);
  });

  it('R33 a cancel stops the work and nothing is returned', async () => {
    const controller = new AbortController();
    const maps = pictures();
    const read = vi.fn(async (kind: MapKind) => {
      if (kind === 'normal') controller.abort();
      return maps[kind] ?? null;
    });
    await expect(buildExportZip(inputFor({}, { signal: controller.signal }, read))).rejects.toMatchObject({ name: 'AbortError' });
    expect(read.mock.calls.map(([kind]) => kind)).not.toContain('metal');
  });
});
