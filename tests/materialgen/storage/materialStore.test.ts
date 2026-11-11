import { describe, expect, expectTypeOf, it } from 'vitest';
import { IDBFactory } from 'fake-indexeddb';
import type { ListViewStore } from '@shared/projects/ui/useProjectList';
import type { StartupStore } from '@shared/shell/routing/startup';
import type { SettingsStore } from '@shared/shell/settings/SettingsView';
import type { MaterialProjectStore } from '@mat/storage/MaterialProjectStore';
import type { MaterialRecord } from '@mat/storage/materialRecord';
import { readMaterialSettings } from '@mat/storage/materialSettings';
import { createTestMaterialStore, png } from './materialStoreFixtures';

async function created(test: Awaited<ReturnType<typeof createTestMaterialStore>>, name = 'Mossy brick', size: 1024 | null = 1024): Promise<MaterialRecord> {
  const result = await test.store.createProject({ name, size });
  if (!result.ok) throw new Error(result.error.message);
  return result.value;
}

describe('MaterialProjectStore shape', () => {
  it('shared/materialgen-prep R59 the material store satisfies what the shared list, shell and settings need', () => {
    expectTypeOf<MaterialProjectStore>().toMatchTypeOf<ListViewStore>();
    expectTypeOf<MaterialProjectStore>().toMatchTypeOf<SettingsStore>();
    expectTypeOf<MaterialProjectStore>().toMatchTypeOf<StartupStore>();
    expect(true).toBe(true);
  });
});

describe('MaterialProjectStore projects', () => {
  it('materialgen/app R25 createProject stores an empty texture project and lists it', async () => {
    const test = await createTestMaterialStore();
    const record = await created(test);
    expect(record).toMatchObject({ id: 'id-1', name: 'Mossy brick', kind: 'texture', size: 1024, colorMode: 'albedo', maps: {}, createdAt: '2026-11-10T09:00:00.000Z' });
    const listed = await test.store.listProjects();
    expect(listed).toEqual({ ok: true, value: [{ id: 'id-1', name: 'Mossy brick', updatedAt: '2026-11-10T09:00:00.000Z', detail: 'Texture · 1024 px' }] });
  });

  it('materialgen/app R24a a name of 0 or more than 120 characters is refused and nothing is stored', async () => {
    const test = await createTestMaterialStore();
    expect((await test.store.createProject({ name: '   ', size: null })).ok).toBe(false);
    expect((await test.store.createProject({ name: 'x'.repeat(121), size: null })).ok).toBe(false);
    expect(await test.store.listProjects()).toEqual({ ok: true, value: [] });
  });

  it('materialgen/app R24a a name is trimmed', async () => {
    const test = await createTestMaterialStore();
    expect((await created(test, '  Rust  ')).name).toBe('Rust');
  });

  it('materialgen/app R30 the list is newest change first', async () => {
    const test = await createTestMaterialStore();
    await created(test, 'First');
    test.advance(5);
    await created(test, 'Second');
    const listed = await test.store.listProjects();
    expect(listed.ok && listed.value.map((row) => row.name)).toEqual(['Second', 'First']);
  });

  it('materialgen/app R30 loadProject returns the record and says not-found for an unknown id', async () => {
    const test = await createTestMaterialStore();
    const record = await created(test);
    expect(await test.store.loadProject('id-1')).toEqual({ ok: true, value: record });
    const missing = await test.store.loadProject('nope');
    expect(!missing.ok && missing.error.code).toBe('not-found');
  });

  it('materialgen/app R33 saveProject stores the record and moves it to the top of the list', async () => {
    const test = await createTestMaterialStore();
    const first = await created(test, 'First');
    test.advance(5);
    await created(test, 'Second');
    test.advance(5);
    const saved = await test.store.saveProject({ ...first, prompt: 'mossy' });
    expect(saved.ok).toBe(true);
    const loaded = await test.store.loadProject('id-1');
    expect(loaded.ok && loaded.value).toMatchObject({ prompt: 'mossy', updatedAt: '2026-11-10T09:00:10.000Z', createdAt: '2026-11-10T09:00:00.000Z' });
    const listed = await test.store.listProjects();
    expect(listed.ok && listed.value.map((row) => row.name)).toEqual(['First', 'Second']);
  });

  it('materialgen/app R29 saveProject refuses a record that holds image data and keeps the stored one', async () => {
    const test = await createTestMaterialStore();
    const record = await created(test);
    const saved = await test.store.saveProject({ ...record, prompt: `data:image/png;base64,${'A'.repeat(50)}` });
    expect(!saved.ok && saved.error).toMatchObject({ code: 'corrupt', message: expect.stringMatching(/^Invalid project\./) });
    const loaded = await test.store.loadProject('id-1');
    expect(loaded.ok && loaded.value.prompt).toBe('');
  });

  it('materialgen/app R33 saveProject of an unknown project says not-found and stores nothing', async () => {
    const test = await createTestMaterialStore();
    const record = await created(test);
    const saved = await test.store.saveProject({ ...record, id: 'ghost' });
    expect(!saved.ok && saved.error.code).toBe('not-found');
  });

  it('materialgen/app R23b renameProject changes the name, validates it and moves the project to the top', async () => {
    const test = await createTestMaterialStore();
    await created(test, 'Old');
    expect((await test.store.renameProject('id-1', ' ')).ok).toBe(false);
    test.advance(3);
    expect((await test.store.renameProject('id-1', 'New')).ok).toBe(true);
    const loaded = await test.store.loadProject('id-1');
    expect(loaded.ok && loaded.value).toMatchObject({ name: 'New', updatedAt: '2026-11-10T09:00:03.000Z' });
  });

  it('materialgen/app R33 saveProject never changes the name: a save queued before a rename cannot undo it', async () => {
    const test = await createTestMaterialStore();
    const old = await created(test, 'Old');
    expect((await test.store.renameProject('id-1', 'New')).ok).toBe(true);
    expect((await test.store.saveProject({ ...old, prompt: 'late edit' })).ok).toBe(true);
    const loaded = await test.store.loadProject('id-1');
    expect(loaded.ok && loaded.value).toMatchObject({ name: 'New', prompt: 'late edit' });
  });

  it('materialgen/app R28 a record saved by a newer version is listed as unreadable and is left untouched', async () => {
    const test = await createTestMaterialStore();
    const record = await created(test);
    await test.database.run(['projects'], 'readwrite', (tx) => tx.putProject({ ...record, schemaVersion: 99 }));
    const listed = await test.store.listProjects();
    expect(listed.ok && listed.value[0]).toMatchObject({ id: 'id-1', name: 'Mossy brick', unreadable: 'This project was saved by a newer version.' });
    const loaded = await test.store.loadProject('id-1');
    expect(!loaded.ok && loaded.error.code).toBe('schema-too-new');
    const raw = await test.database.run(['projects'], 'readonly', (tx) => tx.get('projects', 'id-1'));
    expect(raw.ok && raw.value?.schemaVersion).toBe(99);
  });

  it('materialgen/app R35 a damaged record that still has an id is listed as unreadable so it can be deleted, and is left untouched', async () => {
    const test = await createTestMaterialStore();
    const record = await created(test);
    const damaged = { ...record, maps: { albedo: { originalKey: 5 } } }; // breaks the record rules
    await test.database.run(['projects'], 'readwrite', (tx) => tx.putProject(damaged as never));
    const listed = await test.store.listProjects();
    expect(listed.ok && listed.value).toHaveLength(1);
    expect(listed.ok && listed.value[0]).toMatchObject({ id: 'id-1', name: 'Mossy brick', unreadable: 'This project is damaged and cannot be opened.' });
    const deleted = await test.store.deleteProjects(['id-1']);
    expect(deleted.ok).toBe(true);
    expect(await test.store.listProjects()).toEqual({ ok: true, value: [] });
  });
});

describe('MaterialProjectStore deleting', () => {
  it('materialgen/app R35 deleting removes the record, the thumbnail and every file of the project', async () => {
    const test = await createTestMaterialStore();
    await created(test);
    await test.store.writeBlob('id-1', 'maps/a.png', png(1));
    await test.store.saveThumbnail('id-1', png(2));
    const progress: number[] = [];
    expect((await test.store.deleteProjects(['id-1', 'unknown'], (done) => progress.push(done))).ok).toBe(true);
    expect(progress).toEqual([1, 2]);
    expect(await test.store.listProjects()).toEqual({ ok: true, value: [] });
    expect(await test.blobs.list('id-1')).toEqual([]);
    expect(await test.store.loadThumbnail('id-1')).toBeNull();
  });

  it('materialgen/app R35 a failed file delete is reported and the project stays listed as Partly deleted', async () => {
    const test = await createTestMaterialStore();
    await created(test);
    await test.store.writeBlob('id-1', 'maps/a.png', png(1));
    test.blobs.failNextWrite('storage-unavailable');
    const deleted = await test.store.deleteProjects(['id-1']);
    expect(!deleted.ok && deleted.error.code).toBe('storage-unavailable');
    const listed = await test.store.listProjects();
    expect(listed.ok && listed.value[0]).toMatchObject({ id: 'id-1', detail: 'Partly deleted' });
    expect((await test.store.deleteProjects(['id-1'])).ok).toBe(true); // a second try finishes the job
    expect(await test.store.listProjects()).toEqual({ ok: true, value: [] });
  });
});

describe('MaterialProjectStore files and thumbnail', () => {
  it('materialgen/app R30 a written file reads back, and a deleted or unknown one is null', async () => {
    const test = await createTestMaterialStore();
    await created(test);
    expect((await test.store.writeBlob('id-1', 'maps/a.png', png(7, 8))).ok).toBe(true);
    expect(Array.from(new Uint8Array(await (await test.store.readBlob('id-1', 'maps/a.png'))!.arrayBuffer()))).toEqual([7, 8]);
    await test.store.deleteBlob('id-1', 'maps/a.png');
    expect(await test.store.readBlob('id-1', 'maps/a.png')).toBeNull();
  });

  it('materialgen/app R23a saveThumbnail keeps the picture and marks the record without reordering the list', async () => {
    const test = await createTestMaterialStore();
    await created(test, 'First');
    test.advance(5);
    await created(test, 'Second');
    test.advance(5);
    expect((await test.store.saveThumbnail('id-1', png(9))).ok).toBe(true);
    expect(await test.store.loadThumbnail('id-1')).not.toBeNull();
    const listed = await test.store.listProjects();
    expect(listed.ok && listed.value.map((row) => row.name)).toEqual(['Second', 'First']);
    expect(listed.ok && listed.value[1]?.thumbnailKey).toBe('thumbnail.jpg');
  });
});

describe('MaterialProjectStore sweep', () => {
  it('materialgen/app R34 opening sweeps files no field references, keeps the record, and reports referenced files that are missing', async () => {
    const test = await createTestMaterialStore();
    const record = await created(test);
    const withMap: MaterialRecord = { ...record, maps: { albedo: { originalKey: 'maps/a1.png', workingKey: 'maps/a1.png', undoKey: null, width: 8, height: 8 } } };
    await test.store.saveProject(withMap);
    await test.store.writeBlob('id-1', 'maps/orphan.png', png(1)); // left by a crash between the commit and the delete
    const swept = await test.store.sweepOrphanBlobs('id-1');
    expect(swept).toEqual({ ok: true, value: { deleted: 1, missing: ['maps/a1.png'] } });
    expect(await test.blobs.list('id-1')).toEqual([]);
    const loaded = await test.store.loadProject('id-1');
    expect(loaded.ok && loaded.value.maps).toEqual(withMap.maps);
  });
});

describe('MaterialProjectStore settings and storage', () => {
  it('materialgen/app R27 settings default, merge on save, and keep previewPrefs apart from the viewport', async () => {
    const test = await createTestMaterialStore();
    const defaults = await test.store.loadAppSettings();
    expect(defaults).toMatchObject({ lastOpenProjectId: null, viewport: {}, previewPrefs: { mesh: 'ball', meshResolution: 2, aoIntensity: 1, maskOverlayOpacity: 0.5 } });
    await test.store.saveAppSettings({ lastOpenProjectId: 'id-1', previewPrefs: { mesh: 'plane', meshResolution: 9, aoIntensity: 1, maskOverlayOpacity: 0.5, normalDirection: 'opengl' } });
    await test.store.saveAppSettings({ panels: { leftPx: 300, rightPx: null } });
    const stored = await test.store.loadAppSettings();
    expect(stored).toMatchObject({ lastOpenProjectId: 'id-1', panels: { leftPx: 300, rightPx: null }, previewPrefs: { mesh: 'plane', meshResolution: 4 }, viewport: {} });
  });

  it('materialgen/generation R20 the saved setups are one app-wide list: empty at first, replaced whole on save, kept when other settings save, and a damaged value reads as empty', async () => {
    const test = await createTestMaterialStore();
    expect((await test.store.loadAppSettings()).savedSetups).toEqual([]);
    const list = [{ name: 'Mossy', plan: { images: [], decomposition: null } }];
    await test.store.saveAppSettings({ savedSetups: list });
    await test.store.saveAppSettings({ lastOpenProjectId: 'id-1' });
    expect((await test.store.loadAppSettings()).savedSetups).toEqual(list);
    await test.store.saveAppSettings({ savedSetups: [] });
    expect((await test.store.loadAppSettings()).savedSetups).toEqual([]);
    expect(readMaterialSettings({ savedSetups: 'broken' }).savedSetups).toEqual([]);
    expect(readMaterialSettings({ savedSetups: [{ name: 'ok' }, 4, null] }).savedSetups).toEqual([{ name: 'ok' }]);
  });

  it('materialgen/app R31 two stores with different app ids share nothing in one browser profile', async () => {
    const factory = new IDBFactory();
    const one = await createTestMaterialStore('app-one', factory);
    const two = await createTestMaterialStore('app-two', factory);
    await one.store.createProject({ name: 'Only in one', size: null });
    await one.store.saveAppSettings({ lastOpenProjectId: 'id-1' });
    expect(await two.store.listProjects()).toEqual({ ok: true, value: [] });
    expect((await two.store.loadAppSettings()).lastOpenProjectId).toBeNull();
  });

  it('materialgen/app R31 the database has the stores projects, thumbnails and settings only', async () => {
    const test = await createTestMaterialStore('material-lab');
    const names = await new Promise<string[]>((resolve, reject) => {
      const request = test.factory.open('app-material-lab-projects');
      request.onsuccess = () => {
        const found = Array.from(request.result.objectStoreNames).sort();
        request.result.close();
        resolve(found);
      };
      request.onerror = () => reject(request.error);
    });
    expect(names).toEqual(['projects', 'settings', 'thumbnails']);
  });

  it('materialgen/app R36 storage health comes from the browser storage manager and is null or false without one', async () => {
    const test = await createTestMaterialStore();
    expect(await test.store.estimateStorage()).toBeNull();
    expect(await test.store.requestPersistence()).toBe(false);
  });
});
