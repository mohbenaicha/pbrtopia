import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { openDesktopMaterialApp } from '../../../../src/materialgen/app/desktop/openDesktopMaterialApp';
import { createFakeTauriInvoke } from '../../../support/storageDesktop/fakeTauriInvoke';
import { createMemoryRecordBridge } from '../../../support/storageDesktop/memoryRecordBridge';
import { createNodeFileBridge } from '../../../support/storageDesktop/nodeFileBridge';

let library: string;
let appdata: string;
beforeEach(async () => {
  library = await mkdtemp(join(tmpdir(), 'mat-lib-'));
  appdata = await mkdtemp(join(tmpdir(), 'mat-data-'));
});
afterEach(async () => {
  await rm(library, { recursive: true, force: true });
  await rm(appdata, { recursive: true, force: true });
});

function fakeWith(openFails?: { kind: string; message: string }) {
  return createFakeTauriInvoke({
    records: createMemoryRecordBridge(),
    library: createNodeFileBridge(library),
    appdata: createNodeFileBridge(appdata),
    libraryCommands: {
      library_open: () => {
        if (openFails !== undefined) throw openFails;
        return 'D:\\Materials';
      },
    },
  });
}

describe('the material app on the desktop backend (storage-backends R4, R15)', () => {
  it('R4 the same material store works over the desktop backend: create, list, load, delete', async () => {
    const opened = await openDesktopMaterialApp({ invoke: fakeWith().invoke });
    if (!opened.ok) throw new Error('the store should have opened');
    const { store } = opened.value;
    const created = await store.createProject({ name: 'Bricks', size: null });
    if (!created.ok) throw new Error(created.error.message);
    const listed = await store.listProjects();
    expect(listed.ok && listed.value.map((summary) => summary.name)).toEqual(['Bricks']);
    const loaded = await store.loadProject(created.value.id);
    expect(loaded.ok && loaded.value.name).toBe('Bricks');
    expect((await store.deleteProjects([created.value.id])).ok).toBe(true);
  });

  it('R10 the backends carry the storage location and the desktop vault, under the material app\'s own names', async () => {
    const fake = fakeWith();
    const opened = await openDesktopMaterialApp({ invoke: fake.invoke });
    if (!opened.ok) throw new Error('the store should have opened');
    const { backends } = opened.value;
    expect(backends.location?.path).toBe('D:\\Materials');
    expect(backends.appId).toBeDefined();
    expect(backends.pickers).toBeDefined(); // R13: the exports use the native dialogs
    expect(await backends.vaultStorage.load()).toBeNull();
    expect(fake.calls.some((call) => call.command === 'file_read_chunk' && (call.args as { root: string }).root === 'appdata')).toBe(true);
  });

  it('R9 a library that cannot be opened is a storage-unavailable store error with the Rust message', async () => {
    const opened = await openDesktopMaterialApp({ invoke: fakeWith({ kind: 'missing-root', message: 'The library folder cannot be found.' }).invoke });
    expect(opened).toMatchObject({ ok: false, error: { code: 'storage-unavailable', message: 'The library folder cannot be found.' } });
  });
});
