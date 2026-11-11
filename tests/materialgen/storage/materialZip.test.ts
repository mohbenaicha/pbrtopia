import { strFromU8, strToU8, unzipSync, zipSync } from 'fflate';
import { describe, expect, it } from 'vitest';
import { collectingSink, streamOf } from '../../projects/zip/zipFixtures';
import { exportMaterialZip } from '@mat/storage/zip/exportMaterialZip';
import { importMaterialZip } from '@mat/storage/zip/importMaterialZip';
import type { MaterialRecord } from '@mat/storage/materialRecord';
import { createTestMaterialStore, png, type TestMaterialStore } from './materialStoreFixtures';

const APP_ID = 'material-lab';

async function projectWithMaps(test: TestMaterialStore): Promise<MaterialRecord> {
  const made = await test.store.createProject({ name: 'Mossy brick', size: 512 });
  if (!made.ok) throw new Error('create failed');
  const record: MaterialRecord = {
    ...made.value,
    prompt: 'mossy brick',
    referenceImages: ['references/ref.png'],
    maps: {
      albedo: { originalKey: 'maps/a1.png', workingKey: 'maps/a1.png', undoKey: null, width: 512, height: 512 }, // original and working are one file
      height: { originalKey: 'maps/h1.png', workingKey: 'maps/h2.png', undoKey: 'maps/h1.png', undo: { label: 'Filter' }, width: 512, height: 512 },
    },
  };
  await test.store.writeBlob('id-1', 'maps/a1.png', png(1, 1));
  await test.store.writeBlob('id-1', 'maps/h1.png', png(2, 2));
  await test.store.writeBlob('id-1', 'maps/h2.png', png(3, 3));
  await test.store.writeBlob('id-1', 'references/ref.png', png(4, 4));
  await test.store.saveProject(record);
  await test.store.saveThumbnail('id-1', png(9, 9));
  const loaded = await test.store.loadProject('id-1');
  if (!loaded.ok) throw new Error('load failed');
  return loaded.value;
}

// Everything an import is allowed to change (app R39).
const withoutIdentity = (record: MaterialRecord): Partial<MaterialRecord> => {
  const copy: Partial<MaterialRecord> = { ...record };
  delete copy.id;
  delete copy.createdAt;
  delete copy.updatedAt;
  return copy;
};

async function exported(test: TestMaterialStore, id = 'id-1', appId = APP_ID): Promise<Uint8Array> {
  const out = collectingSink();
  const result = await exportMaterialZip(test.store, id, out.sink, undefined, { appId });
  if (!result.ok) throw new Error(result.error.message);
  return out.bytes();
}

// A zip assembled by hand, to give the importer things the exporter never writes.
function handMadeZip(record: unknown, blobs: Record<string, Uint8Array>, manifest: Record<string, unknown> = {}): Uint8Array {
  const entries: Record<string, Uint8Array> = { 'project.json': strToU8(JSON.stringify(record)) };
  for (const [key, bytes] of Object.entries(blobs)) entries[`blobs/${key}`] = bytes;
  const files = Object.entries(entries).map(([path, bytes]) => ({ path, bytes: bytes.length }));
  const head = { app: `app-${APP_ID}`, formatVersion: 1, exportedAt: '2026-11-10T09:00:00.000Z', projectId: (record as { id: string }).id, projectName: 'x', files, ...manifest };
  return zipSync({ 'manifest.json': strToU8(JSON.stringify(head)), ...entries }, { level: 0 });
}

describe('exportMaterialZip', () => {
  it('materialgen/app R37 the zip holds the manifest, the record, the thumbnail and every referenced file once', async () => {
    const test = await createTestMaterialStore();
    await projectWithMaps(test);
    const files = unzipSync(await exported(test));
    expect(Object.keys(files).sort()).toEqual(['blobs/maps/a1.png', 'blobs/maps/h1.png', 'blobs/maps/h2.png', 'blobs/references/ref.png', 'blobs/thumbnail.jpg', 'manifest.json', 'project.json']);
    const manifest = JSON.parse(strFromU8(files['manifest.json']!)) as Record<string, unknown>;
    expect(manifest).toMatchObject({ app: 'app-material-lab', projectId: 'id-1', projectName: 'Mossy brick', formatVersion: 1 });
    const record = JSON.parse(strFromU8(files['project.json']!)) as MaterialRecord;
    expect(record.thumbnailKey).toBeUndefined();
    expect(record.maps.albedo?.workingKey).toBe('maps/a1.png');
  });

  it('materialgen/app R37 progress counts the manifest and every file', async () => {
    const test = await createTestMaterialStore();
    await projectWithMaps(test);
    const seen: [number, number][] = [];
    const out = collectingSink();
    await exportMaterialZip(test.store, 'id-1', out.sink, (done, total) => seen.push([done, total]), { appId: APP_ID });
    expect(seen.at(-1)).toEqual([7, 7]);
  });

  it('materialgen/app R37 a project whose file is missing cannot be exported and says which', async () => {
    const test = await createTestMaterialStore();
    await projectWithMaps(test);
    await test.store.deleteBlob('id-1', 'maps/h2.png');
    const out = collectingSink();
    const result = await exportMaterialZip(test.store, 'id-1', out.sink, undefined, { appId: APP_ID });
    expect(!result.ok && result.error).toMatchObject({ code: 'not-found', message: expect.stringContaining('maps/h2.png') });
  });

  it('materialgen/app R37 an unknown project is not-found', async () => {
    const test = await createTestMaterialStore();
    const out = collectingSink();
    const result = await exportMaterialZip(test.store, 'nope', out.sink, undefined, { appId: APP_ID });
    expect(!result.ok && result.error.code).toBe('not-found');
  });
});

describe('importMaterialZip', () => {
  it('materialgen/app R39 export then import gives the same project under a new id with the same files', async () => {
    const source = await createTestMaterialStore();
    const original = await projectWithMaps(source);
    const bytes = await exported(source);
    const target = await createTestMaterialStore();
    const imported = await importMaterialZip(target.store, streamOf(bytes), undefined, { appId: APP_ID, newId: () => 'fresh-1' });
    expect(imported.ok).toBe(true);
    const loaded = await target.store.loadProject('fresh-1');
    if (!loaded.ok) throw new Error('load failed');
    expect(withoutIdentity(loaded.value)).toEqual(withoutIdentity(original));
    for (const key of ['maps/a1.png', 'maps/h1.png', 'maps/h2.png', 'references/ref.png']) {
      const a = new Uint8Array(await (await source.store.readBlob('id-1', key))!.arrayBuffer());
      const b = new Uint8Array(await (await target.store.readBlob('fresh-1', key))!.arrayBuffer());
      expect(Array.from(b)).toEqual(Array.from(a));
    }
    expect(await target.store.loadThumbnail('fresh-1')).not.toBeNull();
  });

  it('materialgen/app R38 progress counts the zip entries', async () => {
    const source = await createTestMaterialStore();
    await projectWithMaps(source);
    const target = await createTestMaterialStore();
    const seen: [number, number][] = [];
    await importMaterialZip(target.store, streamOf(await exported(source)), (done, total) => seen.push([done, total]), { appId: APP_ID });
    expect(seen.at(-1)).toEqual([7, 7]);
  });

  it('materialgen/app R36 R38 when the unzipped size does not fit the free space, nothing is written and the message says how much is needed', async () => {
    const source = await createTestMaterialStore();
    await projectWithMaps(source);
    const target = await createTestMaterialStore();
    const result = await importMaterialZip(target.store, streamOf(await exported(source)), undefined, { appId: APP_ID, newId: () => 'fresh-1', estimateFreeBytes: async () => 3 });
    expect(!result.ok && result.error.code).toBe('quota-exceeded');
    expect(!result.ok && result.error.message).toMatch(/^Not enough storage: about [\d.]+ MB needed, 0\.0 MB free\./);
    expect(await target.blobs.list('fresh-1')).toEqual([]);
    expect(await target.store.listProjects()).toEqual({ ok: true, value: [] });
  });

  it('materialgen/app R36 enough room, or a browser that will not say, imports as usual', async () => {
    const source = await createTestMaterialStore();
    await projectWithMaps(source);
    const bytes = await exported(source);
    for (const free of [10_000_000, null]) {
      const target = await createTestMaterialStore();
      const result = await importMaterialZip(target.store, streamOf(bytes), undefined, { appId: APP_ID, estimateFreeBytes: async () => free });
      expect(result.ok).toBe(true);
    }
  });

  it('materialgen/app R38 a zip of another app is refused with "This is not a material project."', async () => {
    const source = await createTestMaterialStore();
    await projectWithMaps(source);
    const target = await createTestMaterialStore();
    const result = await importMaterialZip(target.store, streamOf(await exported(source, 'id-1', 'other-app')), undefined, { appId: APP_ID });
    expect(!result.ok && result.error.message).toBe('This is not a material project.');
  });

  it('materialgen/app R38 a damaged zip stores nothing', async () => {
    const source = await createTestMaterialStore();
    await projectWithMaps(source);
    await source.store.writeBlob('id-1', 'maps/a1.png', png(...new Array<number>(40).fill(171))); // a recognisable run, stored as it is
    const damaged = (await exported(source)).slice();
    const run = damaged.findIndex((_, at) => damaged.slice(at, at + 40).every((byte) => byte === 171));
    expect(run).toBeGreaterThan(0);
    damaged[run + 20] = 172;
    const target = await createTestMaterialStore();
    const result = await importMaterialZip(target.store, streamOf(damaged), undefined, { appId: APP_ID, newId: () => 'fresh-1' });
    expect(result.ok).toBe(false);
    expect(await target.store.listProjects()).toEqual({ ok: true, value: [] });
    expect(await target.blobs.list('fresh-1')).toEqual([]);
  });

  it('materialgen/app R38 a zip cut off in the middle stores nothing', async () => {
    const source = await createTestMaterialStore();
    await projectWithMaps(source);
    const bytes = await exported(source);
    const target = await createTestMaterialStore();
    const result = await importMaterialZip(target.store, streamOf(bytes.slice(0, Math.floor(bytes.length * 0.6))), undefined, { appId: APP_ID, newId: () => 'fresh-1' });
    expect(result.ok).toBe(false);
    expect(await target.store.listProjects()).toEqual({ ok: true, value: [] });
    expect(await target.blobs.list('fresh-1')).toEqual([]);
  });

  it('materialgen/app R38 a name that is already in use gets " (imported)"', async () => {
    const source = await createTestMaterialStore();
    await projectWithMaps(source);
    const bytes = await exported(source);
    const target = await createTestMaterialStore();
    await target.store.createProject({ name: 'Mossy brick', size: null });
    const result = await importMaterialZip(target.store, streamOf(bytes), undefined, { appId: APP_ID, newId: () => 'fresh-1' });
    expect(result.ok && result.value.name).toBe('Mossy brick (imported)');
  });

  it('materialgen/app R38 a hand-made zip with a consistent record imports', async () => {
    const source = await createTestMaterialStore();
    const record = await projectWithMaps(source);
    const target = await createTestMaterialStore();
    const blobs = { 'maps/a1.png': png(1) , 'maps/h1.png': png(2), 'maps/h2.png': png(3), 'references/ref.png': png(4) };
    const bytes = handMadeZip(record, Object.fromEntries(await Promise.all(Object.entries(blobs).map(async ([key, blob]) => [key, new Uint8Array(await blob.arrayBuffer())] as const))));
    const result = await importMaterialZip(target.store, streamOf(bytes), undefined, { appId: APP_ID, newId: () => 'fresh-1' });
    expect(result.ok).toBe(true);
  });

  it('materialgen/app R38 a record that names a file the zip does not hold is refused and nothing is left behind', async () => {
    const source = await createTestMaterialStore();
    const record = await projectWithMaps(source);
    const target = await createTestMaterialStore();
    const bytes = handMadeZip(record, { 'maps/a1.png': new Uint8Array([1]), 'maps/h1.png': new Uint8Array([2]), 'references/ref.png': new Uint8Array([4]) }); // maps/h2.png is missing
    const result = await importMaterialZip(target.store, streamOf(bytes), undefined, { appId: APP_ID, newId: () => 'fresh-1' });
    expect(!result.ok && result.error.message).toContain('maps/h2.png');
    expect(await target.store.listProjects()).toEqual({ ok: true, value: [] });
    expect(await target.blobs.list('fresh-1')).toEqual([]);
  });

  it('materialgen/app R38 a file no field of the record uses is refused', async () => {
    const source = await createTestMaterialStore();
    const record = await projectWithMaps(source);
    const target = await createTestMaterialStore();
    const all = { 'maps/a1.png': new Uint8Array([1]), 'maps/h1.png': new Uint8Array([2]), 'maps/h2.png': new Uint8Array([3]), 'references/ref.png': new Uint8Array([4]), 'maps/stray.png': new Uint8Array([5]) };
    const result = await importMaterialZip(target.store, streamOf(handMadeZip(record, all)), undefined, { appId: APP_ID, newId: () => 'fresh-1' });
    expect(!result.ok && result.error.message).toContain('maps/stray.png');
    expect(await target.blobs.list('fresh-1')).toEqual([]);
  });

  it('materialgen/app R29 an imported record that holds image data is refused', async () => {
    const source = await createTestMaterialStore();
    const record = await projectWithMaps(source);
    const target = await createTestMaterialStore();
    const bytes = handMadeZip({ ...record, prompt: `data:image/png;base64,${'A'.repeat(40)}` }, {});
    const result = await importMaterialZip(target.store, streamOf(bytes), undefined, { appId: APP_ID, newId: () => 'fresh-1' });
    expect(!result.ok && result.error.message).toMatch(/^Invalid project\./);
    expect(await target.store.listProjects()).toEqual({ ok: true, value: [] });
  });

  it('materialgen/app R28 a zip made by a newer version is refused', async () => {
    const source = await createTestMaterialStore();
    const record = await projectWithMaps(source);
    const target = await createTestMaterialStore();
    const bytes = handMadeZip(record, {}, { formatVersion: 99 });
    const result = await importMaterialZip(target.store, streamOf(bytes), undefined, { appId: APP_ID });
    expect(!result.ok && result.error.code).toBe('schema-too-new');
  });
});
