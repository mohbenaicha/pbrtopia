import { describe, expect, it } from 'vitest';
import { streamOf } from '../../support/zipStreams';
import { createTestMaterialStore } from '../storage/materialStoreFixtures';
import { decodePng, encodePng, type PixelImage } from '@mat/maps/png/pngCodec';
import { parseMasksRecord } from '@shared/materialMasks';
import { importMaterialZip } from '@mat/storage/zip/importMaterialZip';
import { convertBlenderExport } from '@mat/samples/convertBlenderExport';
import type { MaterialRecord } from '@mat/storage/materialRecord';

const SIZE = 256;
const RED = [255, 0, 0] as const;
const GREEN = [0, 255, 0] as const;

const solid = (channels: 1 | 3, ...values: number[]): PixelImage => {
  const data = new Uint8Array(SIZE * SIZE * channels);
  for (let at = 0; at < data.length; at += channels) data.set(values.slice(0, channels), at);
  return { width: SIZE, height: SIZE, channels, data };
};

/** A labels picture: the left half is label 0's colour, the right half label 1's. */
function labelsPicture(left: readonly number[] = RED, right: readonly number[] = GREEN): PixelImage {
  const image = solid(3, 0, 0, 0);
  for (let y = 0; y < SIZE; y += 1) for (let x = 0; x < SIZE; x += 1) image.data.set(x < SIZE / 2 ? left : right, (y * SIZE + x) * 3);
  return image;
}

interface ExportOptions {
  material?: Record<string, unknown>;
  masks?: Record<string, unknown> | null;
  labels?: PixelImage | null;
  without?: string[];
}

/** A synthetic Blender export: the files a zip from export/ holds, with an unflipped normal of (10, 20, 30). */
function blenderExport(options: ExportOptions = {}): Record<string, Uint8Array> {
  const files: Record<string, Uint8Array> = {
    'albedo.png': encodePng(solid(3, 200, 100, 50)),
    'normal.png': encodePng(solid(3, 10, 20, 30)),
    'height.png': encodePng(solid(1, 90)),
    'roughness.png': encodePng(solid(1, 120)),
    'metallic.png': encodePng(solid(1, 5)),
    'ao.png': encodePng(solid(1, 250)),
    'build_material.py': new TextEncoder().encode('print("ignored")'),
  };
  const material = {
    schema: 1, target: 'blender', projectName: 'Rocky', name: 'Rocky Desert', size: SIZE, colorMode: 'albedo', normalConvention: 'opengl', packing: 'separate',
    heightScale: 0.05, heightMidlevel: 0.4, tiling: { x: 2, y: 3 },
    files: { albedo: 'albedo.png', normal: 'normal.png', height: 'height.png', roughness: 'roughness.png', metallic: 'metallic.png', ao: 'ao.png' },
    missing: [], stale: [], labels: 'labels.png', masks: 'masks.json', ...options.material,
  };
  files['material.json'] = new TextEncoder().encode(JSON.stringify(material));
  if (options.labels !== null) files['labels.png'] = encodePng(options.labels ?? labelsPicture());
  if (options.masks !== null) {
    const masks = options.masks ?? {
      labels: [
        { index: 0, hex: '#FF0000', name: 'Sand', baseMaterial: 'Sand', roughness: 0.8, metal: 0 },
        { index: 1, hex: '#00FF00', name: 'Rock', baseMaterial: 'Granite', roughness: 0.6, metal: 0.1 },
      ],
    };
    files['masks.json'] = new TextEncoder().encode(JSON.stringify(masks));
  }
  for (const name of options.without ?? []) delete files[name];
  return files;
}

async function importConverted(files: Record<string, Uint8Array>) {
  const converted = await convertBlenderExport(files);
  if (!converted.ok) throw new Error(converted.message);
  const test = await createTestMaterialStore();
  const imported = await importMaterialZip(test.store, streamOf(converted.zip), undefined, { appId: 'material-lab', newId: () => 'fresh-id' });
  return { converted, test, imported };
}

async function importedRecord(files: Record<string, Uint8Array>): Promise<{ record: MaterialRecord; read: (key: string) => Promise<Uint8Array> }> {
  const { test, imported } = await importConverted(files);
  if (!imported.ok) throw new Error(imported.error.message);
  const record = imported.value;
  return { record, read: async (key) => new Uint8Array(await (await test.store.readBlob(record.id, key))!.arrayBuffer()) };
}

async function failureOf(files: Record<string, Uint8Array>): Promise<string> {
  const converted = await convertBlenderExport(files);
  if (converted.ok) throw new Error('the conversion should have failed');
  return converted.message;
}

describe('convertBlenderExport: the project record', () => {
  it('TestR2_the_existing_importer_accepts_the_zip_with_nothing_unused_or_missing', async () => {
    const { imported } = await importConverted(blenderExport());
    expect(imported.ok).toBe(true);
  });

  it('TestR8_the_record_takes_name_size_preset_and_preview_from_material_json', async () => {
    const { record } = await importedRecord(blenderExport());
    expect(record).toMatchObject({ name: 'Rocky Desert', size: SIZE, colorMode: 'albedo', presetId: 'preset-1', prompt: '', referenceImages: [] });
    expect(record.thumbnailKey).toBeUndefined();
    expect(record.preview).toMatchObject({ tilingX: 2, tilingY: 3, heightScale: 0.05, heightLevel: 0.4 });
  });
});

describe('convertBlenderExport: the preview picture', () => {
  const JPEG = new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 1, 2, 3, 4]);

  it('TestR8_a_preview_picture_becomes_the_project_thumbnail_unchanged', async () => {
    const files = { ...blenderExport(), 'preview-rocks.jfif': JPEG };
    const { test, imported } = await importConverted(files);
    if (!imported.ok) throw new Error(imported.error.message);
    const thumbnail = await test.store.loadThumbnail(imported.value.id);
    expect(thumbnail).not.toBeNull();
    expect([...new Uint8Array(await thumbnail!.arrayBuffer())]).toEqual([...JPEG]);
  });

  it('TestR8_an_export_without_a_preview_picture_has_no_thumbnail', async () => {
    const { test, imported } = await importConverted(blenderExport());
    if (!imported.ok) throw new Error(imported.error.message);
    expect(await test.store.loadThumbnail(imported.value.id)).toBeNull();
  });
});

describe('convertBlenderExport: the maps', () => {
  it('TestR4_each_map_is_one_file_with_the_same_original_and_working_key_and_no_undo', async () => {
    const { record } = await importedRecord(blenderExport());
    expect(Object.keys(record.maps).sort()).toEqual(['albedo', 'ao', 'height', 'labels', 'metal', 'normal', 'rough']);
    for (const map of Object.values(record.maps)) {
      expect(map.originalKey).toBe(map.workingKey);
      expect(map.undoKey).toBeNull();
      expect(map).toMatchObject({ width: SIZE, height: SIZE });
    }
    expect(record.maps.height!.source).toEqual({ kind: 'dropped', name: 'height.png' });
    expect(record.maps.rough!.source).toEqual({ kind: 'dropped', name: 'roughness.png' });
  });

  it('TestR4_an_export_without_ao_has_no_ao_map', async () => {
    const { record } = await importedRecord(blenderExport({ material: { files: { albedo: 'albedo.png', normal: 'normal.png', height: 'height.png', roughness: 'roughness.png', metallic: 'metallic.png' }, missing: ['ao'] }, without: ['ao.png'] }));
    expect(record.maps.ao).toBeUndefined();
  });

  it('TestR5_an_opengl_normal_is_kept_as_it_is', async () => {
    const { record, read } = await importedRecord(blenderExport());
    const normal = decodePng(await read(record.maps.normal!.workingKey)) as PixelImage;
    expect([...normal.data.slice(0, 3)]).toEqual([10, 20, 30]);
  });

  it('TestR5_a_directx_normal_has_its_green_channel_turned_back', async () => {
    const { record, read } = await importedRecord(blenderExport({ material: { normalConvention: 'directx' } }));
    const normal = decodePng(await read(record.maps.normal!.workingKey)) as PixelImage;
    expect([...normal.data.slice(0, 3)]).toEqual([10, 235, 30]);
  });

  it('TestR9_diffuse_mode_keeps_the_diffuse_map_and_makes_no_albedo', async () => {
    const { record } = await importedRecord(blenderExport({ material: { colorMode: 'diffuse' } }));
    expect(record.colorMode).toBe('diffuse');
    expect(record.maps.diffuse).toBeDefined();
    expect(record.maps.albedo).toBeUndefined();
  });
});

describe('convertBlenderExport: the masks', () => {
  it('TestR6_the_labels_picture_becomes_one_label_number_per_pixel', async () => {
    const { record, read } = await importedRecord(blenderExport());
    const labels = decodePng(await read(record.maps.labels!.workingKey)) as PixelImage;
    expect(labels.channels).toBe(1);
    expect(labels.data[0]).toBe(0);
    expect(labels.data[SIZE - 1]).toBe(1);
    expect(labels.data[SIZE * SIZE - 1]).toBe(1);
  });

  it('TestR6_the_labels_map_is_computed_from_the_colour_map_and_rough_and_metal_from_the_labels', async () => {
    const { record } = await importedRecord(blenderExport());
    expect(record.maps.labels!.source).toEqual({ kind: 'computed' });
    expect(record.maps.labels!.derivedFrom).toEqual({ kind: 'albedo', key: record.maps.albedo!.workingKey });
    expect(record.maps.rough!.derivedFrom).toEqual({ kind: 'labels', key: record.maps.labels!.workingKey });
    expect(record.maps.metal!.derivedFrom).toEqual({ kind: 'labels', key: record.maps.labels!.workingKey });
  });

  it('TestR6_hex_colours_match_whatever_their_case', async () => {
    const { record } = await importedRecord(blenderExport({ masks: { labels: [
      { index: 0, hex: 'ff0000', name: 'Sand', baseMaterial: 'Sand', roughness: 0.8, metal: 0 },
      { index: 1, hex: '#00ff00', name: 'Rock', baseMaterial: 'Granite', roughness: 0.6, metal: 0.1 },
    ] } }));
    expect(parseMasksRecord(record.masks)!.palette.map((entry) => entry.hex)).toEqual(['#ff0000', '#00ff00']);
  });

  it('TestR7_the_masks_record_has_a_palette_and_one_row_per_label_and_passes_the_parser', async () => {
    const { record } = await importedRecord(blenderExport());
    const masks = parseMasksRecord(record.masks);
    expect(masks).not.toBeNull();
    expect(masks!.palette).toEqual([{ label: 0, hex: '#ff0000', name: 'Sand' }, { label: 1, hex: '#00ff00', name: 'Rock' }]);
    expect(masks!.rows[1]).toEqual({
      label: 1, name: 'Rock', description: '', location: '', defaultMaterial: 'Granite', top3: [], matchKind: 'generic', material: 'Granite', rough: 0.6, metal: 0.1, height: 0,
    });
    expect(masks!.feather).toBe(1);
  });

  it('TestR3_an_export_with_neither_labels_nor_masks_gets_no_masks', async () => {
    const { record } = await importedRecord(blenderExport({ labels: null, masks: null, material: { labels: undefined, masks: undefined } }));
    expect(record.masks).toBeUndefined();
    expect(record.maps.labels).toBeUndefined();
    expect(record.maps.rough!.derivedFrom).toBeUndefined();
  });
});

describe('convertBlenderExport: failures', () => {
  it('TestR10_a_missing_material_json_is_named', async () => {
    expect(await failureOf(blenderExport({ without: ['material.json'] }))).toContain('material.json');
  });

  it('TestR10_a_file_material_json_names_that_is_missing_is_named', async () => {
    expect(await failureOf(blenderExport({ without: ['height.png'] }))).toContain('height.png');
  });

  it('TestR10_a_map_whose_side_is_not_the_size_is_named', async () => {
    const files = blenderExport();
    files['roughness.png'] = encodePng({ width: 8, height: 8, channels: 1, data: new Uint8Array(64) });
    expect(await failureOf(files)).toContain('roughness.png');
  });

  it('TestR10_a_label_colour_that_is_in_no_palette_entry_is_named', async () => {
    expect(await failureOf(blenderExport({ labels: labelsPicture(RED, [1, 2, 3]) }))).toContain('labels.png');
  });

  it('TestR10_two_palette_entries_with_the_same_colour_fail', async () => {
    const message = await failureOf(blenderExport({ masks: { labels: [
      { index: 0, hex: '#FF0000', name: 'A', baseMaterial: 'A', roughness: 0.5, metal: 0 },
      { index: 1, hex: '#ff0000', name: 'B', baseMaterial: 'B', roughness: 0.5, metal: 0 },
    ] } }));
    expect(message).toContain('masks.json');
  });

  it('TestR10_a_label_index_outside_0_to_9_fails', async () => {
    const message = await failureOf(blenderExport({ masks: { labels: [{ index: 10, hex: '#FF0000', name: 'A', baseMaterial: 'A', roughness: 0.5, metal: 0 }] } }));
    expect(message).toContain('masks.json');
  });

  it('TestR10_a_size_that_is_not_a_material_size_fails', async () => {
    expect(await failureOf(blenderExport({ material: { size: 300 } }))).toContain('size');
  });

  it('TestR10_a_packed_export_fails', async () => {
    expect(await failureOf(blenderExport({ material: { packing: 'packed' } }))).toContain('packed');
  });

  it('TestR10_an_unsupported_schema_fails', async () => {
    expect(await failureOf(blenderExport({ material: { schema: 2 } }))).toContain('schema');
  });
});
