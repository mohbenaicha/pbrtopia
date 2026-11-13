import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterAll, describe, expect, it } from 'vitest';
import { collectingSink, streamOf } from '../../projects/zip/zipFixtures';
import { createDesktopBlobStore } from '@shared/storage-desktop/desktopBlobStore';
import { createDesktopRecordEngine } from '@shared/storage-desktop/DesktopRecordEngine';
import { createMaterialStore } from '@mat/storage/createMaterialStore';
import { createDesktopMaterialDatabase } from '@mat/storage/desktopMaterialDatabase';
import { DEFAULT_PREVIEW_VALUES } from '@mat/storage/previewValues';
import { exportMaterialZip } from '@mat/storage/zip/exportMaterialZip';
import { importMaterialZip } from '@mat/storage/zip/importMaterialZip';
import type { MaterialRecord } from '@mat/storage/materialRecord';
import type { MaterialProjectStore } from '@mat/storage/MaterialProjectStore';
import { createMemoryRecordBridge } from '../../support/storageDesktop/memoryRecordBridge';
import { createNodeFileBridge } from '../../support/storageDesktop/nodeFileBridge';
import { createTestMaterialStore, png } from './materialStoreFixtures';

const APP_ID = 'material-lab';
const SIZE = 512;
const folders: string[] = [];
afterAll(async () => void (await Promise.all(folders.map((folder) => rm(folder, { recursive: true, force: true })))));

type Mode = 'browser' | 'desktop';

async function storeIn(mode: Mode): Promise<MaterialProjectStore> {
  if (mode === 'browser') return (await createTestMaterialStore()).store;
  const folder = await mkdtemp(join(tmpdir(), 'mat-zip-across-'));
  folders.push(folder);
  let counter = 0;
  return createMaterialStore({
    database: createDesktopMaterialDatabase(createDesktopRecordEngine(createMemoryRecordBridge())),
    blobs: createDesktopBlobStore(createNodeFileBridge(folder)),
    newId: () => `id-${++counter}`,
    now: () => new Date('2026-11-12T10:00:00.000Z'),
  });
}

/** Keys that are legal in a browser but need escaping on Windows (storage-backends R6). */
const AWKWARD = { albedo: 'maps/CON.png', height: 'maps/what? "why"*.png', heightWork: 'maps/ends with a dot.', heightBase: 'maps/pipe|angle<>.png', reference: 'references/aux.png' };

const byteOf = (key: string): number => [...key].reduce((sum, char) => (sum * 31 + char.charCodeAt(0)) % 251, 7);

async function fillProject(store: MaterialProjectStore): Promise<MaterialRecord> {
  const made = await store.createProject({ name: 'Mossy brick', size: SIZE });
  if (!made.ok) throw new Error('create failed');
  const record: MaterialRecord = {
    ...made.value,
    colorMode: 'diffuse',
    prompt: 'mossy brick wall',
    referenceImages: [AWKWARD.reference],
    presetId: 'preset-2',
    customPlan: { albedo: { model: 'gpt-image-2', resolution: '1k' } },
    maps: {
      albedo: { originalKey: AWKWARD.albedo, workingKey: AWKWARD.albedo, undoKey: null, width: SIZE, height: SIZE },
      height: { originalKey: AWKWARD.height, workingKey: AWKWARD.heightWork, undoKey: null, offsetBase: AWKWARD.heightBase, width: SIZE, height: SIZE },
    },
    aoParams: { radius: 12, strength: 0.8 },
    preview: { ...DEFAULT_PREVIEW_VALUES, tilingX: 2, tilingY: 3, heightScale: 0.07 },
  };
  for (const key of Object.values(AWKWARD)) await store.writeBlob(made.value.id, key, png(byteOf(key)));
  const saved = await store.saveProject(record);
  if (!saved.ok) throw new Error(saved.error.message);
  await store.saveThumbnail(made.value.id, png(9, 9));
  const loaded = await store.loadProject(made.value.id);
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

describe.each<[Mode, Mode]>([
  ['browser', 'desktop'],
  ['desktop', 'browser'],
  ['desktop', 'desktop'],
])('a material project zip made in the %s app imports in the %s app (storage-backends R2, R3)', (from, to) => {
  it('R3 every record field and every file comes back, including the keys that need escaping on Windows, and the thumbnail', async () => {
    const source = await storeIn(from);
    const original = await fillProject(source);
    const out = collectingSink();
    const exported = await exportMaterialZip(source, original.id, out.sink, undefined, { appId: APP_ID });
    expect(exported.ok).toBe(true);

    const target = await storeIn(to);
    const imported = await importMaterialZip(target, streamOf(out.bytes()), undefined, { appId: APP_ID, newId: () => 'fresh-1' });
    expect(imported.ok).toBe(true);
    const loaded = await target.loadProject('fresh-1');
    if (!loaded.ok) throw new Error('load failed');
    expect(withoutIdentity(loaded.value)).toEqual(withoutIdentity(original));
    for (const key of Object.values(AWKWARD)) {
      const blob = await target.readBlob('fresh-1', key);
      expect(blob === null ? null : Array.from(new Uint8Array(await blob.arrayBuffer())), key).toEqual([byteOf(key)]);
    }
    expect(await target.loadThumbnail('fresh-1')).not.toBeNull();
  });
});

describe('a material zip with keys that differ only in capitals (storage-backends R6, R3)', () => {
  it('R6 the desktop app refuses to import it with a plain message and leaves no project behind', async () => {
    const source = await storeIn('browser');
    const made = await source.createProject({ name: 'Clash', size: SIZE });
    if (!made.ok) throw new Error('create failed');
    const record: MaterialRecord = {
      ...made.value,
      maps: { albedo: { originalKey: 'maps/Photo.png', workingKey: 'maps/photo.png', undoKey: null, width: SIZE, height: SIZE } },
    };
    for (const key of ['maps/Photo.png', 'maps/photo.png']) await source.writeBlob(made.value.id, key, png(byteOf(key)));
    await source.saveProject(record);
    const out = collectingSink();
    expect((await exportMaterialZip(source, made.value.id, out.sink, undefined, { appId: APP_ID })).ok).toBe(true);

    const target = await storeIn('desktop');
    const imported = await importMaterialZip(target, streamOf(out.bytes()), undefined, { appId: APP_ID, newId: () => 'fresh-1' });
    expect(imported.ok).toBe(false);
    expect(imported.ok ? '' : imported.error.message).not.toMatch(/[A-Za-z]:\\/);
    const listed = await target.listProjects();
    expect(listed.ok && listed.value).toEqual([]);
  });
});
