import { strFromU8, unzipSync } from 'fflate';
import { describe, expect, it } from 'vitest';
import { collectingSink, streamOf } from '../../support/zipStreams';
import { MAP_KINDS } from '@mat/maps';
import { DEFAULT_PREVIEW_VALUES } from '@mat/storage/previewValues';
import { exportMaterialZip } from '@mat/storage/zip/exportMaterialZip';
import { importMaterialZip } from '@mat/storage/zip/importMaterialZip';
import type { MapRecord, MaterialRecord } from '@mat/storage/materialRecord';
import { createTestMaterialStore, png, type TestMaterialStore } from './materialStoreFixtures';

const APP_ID = 'material-lab';
const SIZE = 512;

/** One byte value per stored file, so a copy that swaps two files is caught. */
const byteOf = (key: string): number => [...key].reduce((sum, char) => (sum * 31 + char.charCodeAt(0)) % 251, 7);

/** A project that has every optional part (materialgen/app R37a, R39): all eight map kinds with an undo file, a Height offset with its bases, masks, AO parameters, a custom setup, a reference and a thumbnail. */
async function fullProject(test: TestMaterialStore): Promise<MaterialRecord> {
  const made = await test.store.createProject({ name: 'Mossy brick', size: SIZE });
  if (!made.ok) throw new Error('create failed');
  const maps: Partial<Record<(typeof MAP_KINDS)[number], MapRecord>> = {};
  for (const kind of MAP_KINDS) {
    const base = { originalKey: `maps/${kind}1.png`, workingKey: `maps/${kind}2.png`, width: SIZE, height: SIZE };
    maps[kind] = kind === 'labels' ? { ...base, undoKey: null } : { ...base, undoKey: `maps/${kind}3.png`, undo: { label: 'Filter' } }; // the label map has no undo file
  }
  maps.normal = { ...maps.normal!, derivedFrom: { kind: 'height', key: 'maps/height4.png' }, undo: { label: 'Recompute', derivedFrom: { kind: 'height', key: 'maps/height1.png' } } };
  maps.height = {
    originalKey: 'maps/height1.png',
    workingKey: 'maps/height4.png',
    undoKey: 'maps/height3.png',
    undo: { label: 'Height offset', offsetBase: 'maps/height2.png' },
    offsetBase: 'maps/height5.png',
    width: SIZE,
    height: SIZE,
  };
  const record: MaterialRecord = {
    ...made.value,
    colorMode: 'diffuse',
    prompt: 'mossy brick wall',
    referenceImages: ['references/ref.png'],
    presetId: 'preset-2',
    customPlan: { albedo: { model: 'gpt-image-2', resolution: '1k' } },
    maps,
    masks: {
      source: 'model',
      palette: [{ label: 0, hex: '#ff0000', name: 'Moss' }, { label: 1, hex: '#00ff00', name: 'Brick' }],
      feather: 2,
      rows: [
        { label: 0, name: 'Moss', description: 'green', location: 'top', defaultMaterial: 'moss', top3: ['moss'], matchKind: 'generic', material: 'moss', rough: 0.9, metal: 0, height: 0.35 },
        { label: 1, name: 'Brick', description: 'red', location: 'all', defaultMaterial: 'brick', top3: ['brick'], matchKind: 'generic', material: 'brick', rough: 0.7, metal: 0, height: -0.5 },
      ],
    },
    aoParams: { radius: 12, strength: 0.8 },
    normalParams: { blur: 2, strength: 60 },
    preview: { ...DEFAULT_PREVIEW_VALUES, tilingX: 2, tilingY: 3, heightScale: 0.07 },
  };
  const keys = new Set<string>(['references/ref.png']);
  for (const map of Object.values(maps)) for (const key of [map.originalKey, map.workingKey, map.undoKey, map.offsetBase, map.undo?.offsetBase]) if (key) keys.add(key);
  for (const key of keys) await test.store.writeBlob('id-1', key, png(byteOf(key)));
  const saved = await test.store.saveProject(record);
  if (!saved.ok) throw new Error(saved.error.message);
  await test.store.saveThumbnail('id-1', png(9, 9));
  const loaded = await test.store.loadProject('id-1');
  if (!loaded.ok) throw new Error('load failed');
  return loaded.value;
}

const withoutIdentity = (record: MaterialRecord): Partial<MaterialRecord> => {
  const copy: Partial<MaterialRecord> = { ...record };
  delete copy.id;
  delete copy.createdAt;
  delete copy.updatedAt;
  return copy;
};

async function exportOf(test: TestMaterialStore): Promise<{ bytes: Uint8Array; outcome: unknown }> {
  const out = collectingSink();
  const result = await exportMaterialZip(test.store, 'id-1', out.sink, undefined, { appId: APP_ID });
  if (!result.ok) throw new Error(result.error.message);
  return { bytes: out.bytes(), outcome: result.value };
}

const bytesOf = async (test: TestMaterialStore, id: string, key: string): Promise<number[]> => Array.from(new Uint8Array(await (await test.store.readBlob(id, key))!.arrayBuffer()));

describe('materialgen/app R37 R37a R39 the zip of a project with every optional part', () => {
  it('R39 export then import gives the same record (minus identity) and the same bytes for every file, the Height bases and the thumbnail included', async () => {
    const source = await createTestMaterialStore();
    const original = await fullProject(source);
    const { bytes } = await exportOf(source);
    const target = await createTestMaterialStore();
    const imported = await importMaterialZip(target.store, streamOf(bytes), undefined, { appId: APP_ID, newId: () => 'fresh-1' });
    expect(imported.ok).toBe(true);
    const loaded = await target.store.loadProject('fresh-1');
    if (!loaded.ok) throw new Error('load failed');
    expect(withoutIdentity(loaded.value)).toEqual(withoutIdentity(original));
    const keys = [...MAP_KINDS].flatMap((kind) => [1, 2, 3].map((n) => `maps/${kind}${n}.png`)).filter((key) => key !== 'maps/labels3.png').concat(['maps/height4.png', 'maps/height5.png', 'references/ref.png']);
    for (const key of keys) expect(await bytesOf(target, 'fresh-1', key)).toEqual(await bytesOf(source, 'id-1', key));
    expect(await target.store.loadThumbnail('fresh-1')).not.toBeNull();
  });

  it('R37a the settings that travel with the project are in the zipped record: prompt, preset, custom setup, masks rows with their offsets, AO parameters, preview values', async () => {
    const source = await createTestMaterialStore();
    await fullProject(source);
    const files = unzipSync((await exportOf(source)).bytes);
    const record = JSON.parse(strFromU8(files['project.json']!)) as MaterialRecord;
    expect(record).toMatchObject({ prompt: 'mossy brick wall', presetId: 'preset-2', colorMode: 'diffuse', aoParams: { radius: 12, strength: 0.8 }, normalParams: { blur: 2, strength: 60 } });
    expect(record.customPlan).toEqual({ albedo: { model: 'gpt-image-2', resolution: '1k' } });
    expect((record.masks as { rows: { height: number }[] }).rows.map((row) => row.height)).toEqual([0.35, -0.5]);
    expect(record.preview).toMatchObject({ tilingX: 2, tilingY: 3, heightScale: 0.07 });
    expect(JSON.stringify(record)).not.toMatch(/apiKey|api_key|secret/i); // R37a: a key never leaves the vault
  });

  it('R37 the zip holds the Height offsets\' base files, on the map and on its undo entry', async () => {
    const source = await createTestMaterialStore();
    await fullProject(source);
    const names = Object.keys(unzipSync((await exportOf(source)).bytes));
    expect(names).toContain('blobs/maps/height5.png');
    expect(names).toContain('blobs/maps/height2.png');
  });

  it('R34 the orphan sweep spares the Height offsets\' base files', async () => {
    const source = await createTestMaterialStore();
    await fullProject(source);
    const swept = await source.store.sweepOrphanBlobs('id-1');
    expect(swept.ok && swept.value).toEqual({ deleted: 0, missing: [] });
  });

  it('R37 a missing base of the Height offsets does not stop the export: the zip leaves it out, clears the tags and the outcome says so', async () => {
    const source = await createTestMaterialStore();
    await fullProject(source);
    await source.store.deleteBlob('id-1', 'maps/height5.png');
    await source.store.deleteBlob('id-1', 'maps/height2.png');
    const { bytes, outcome } = await exportOf(source);
    expect(outcome).toEqual({ droppedHeightBase: true });
    const files = unzipSync(bytes);
    expect(Object.keys(files)).not.toContain('blobs/maps/height5.png');
    const record = JSON.parse(strFromU8(files['project.json']!)) as MaterialRecord;
    expect(record.maps.height?.offsetBase).toBeUndefined();
    expect(record.maps.height?.undo?.offsetBase).toBeUndefined();
    expect(record.maps.height?.workingKey).toBe('maps/height4.png'); // the Height map itself is exported as it is
    const target = await createTestMaterialStore();
    expect((await importMaterialZip(target.store, streamOf(bytes), undefined, { appId: APP_ID, newId: () => 'fresh-1' })).ok).toBe(true);
  });

  it('R37 with the bases present the outcome says nothing was dropped', async () => {
    const source = await createTestMaterialStore();
    await fullProject(source);
    expect((await exportOf(source)).outcome).toEqual({ droppedHeightBase: false });
  });

  it('R37 any other missing file still fails the export and names it', async () => {
    const source = await createTestMaterialStore();
    await fullProject(source);
    await source.store.deleteBlob('id-1', 'maps/rough2.png');
    const out = collectingSink();
    const result = await exportMaterialZip(source.store, 'id-1', out.sink, undefined, { appId: APP_ID });
    expect(!result.ok && result.error).toMatchObject({ code: 'not-found', message: expect.stringContaining('maps/rough2.png') });
  });
});
