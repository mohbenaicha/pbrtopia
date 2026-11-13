import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { openDesktopParts } from '../../src/storage-desktop/openDesktopParts';
import { createFakeTauriInvoke } from '../support/storageDesktop/fakeTauriInvoke';
import { createMemoryRecordBridge } from '../support/storageDesktop/memoryRecordBridge';
import { createNodeFileBridge } from '../support/storageDesktop/nodeFileBridge';
import { sampleVaultRecord } from '../keys/vaultFixtures';

let library: string;
let appdata: string;
beforeEach(async () => {
  library = await mkdtemp(join(tmpdir(), 'parts-lib-'));
  appdata = await mkdtemp(join(tmpdir(), 'parts-app-'));
});
afterEach(async () => {
  await rm(library, { recursive: true, force: true });
  await rm(appdata, { recursive: true, force: true });
});

type Chosen = { result: 'chosen'; path: string } | { result: 'cancelled' } | { result: 'refused'; message: string };

/** A scripted library side: what `library_open` finds and what each `library_choose` answers in turn. */
function setup(script: { remembered: string | null; choices?: Chosen[]; openFails?: { kind: string; message: string } }) {
  const choices = [...(script.choices ?? [])];
  const names: string[] = [];
  const fake = createFakeTauriInvoke({
    records: createMemoryRecordBridge(),
    library: createNodeFileBridge(library),
    appdata: createNodeFileBridge(appdata),
    libraryCommands: {
      library_open: () => {
        names.push('library_open');
        if (script.openFails !== undefined) throw script.openFails;
        return script.remembered;
      },
      library_choose: () => {
        names.push('library_choose');
        return choices.shift() ?? { result: 'cancelled' };
      },
      library_use_default: () => {
        names.push('library_use_default');
        return 'C:\\Users\\Someone\\Texturium';
      },
      library_show_in_folder: () => {
        names.push('library_show_in_folder');
        return null;
      },
    },
  });
  return { fake, names };
}

describe('opening the desktop library (storage-backends R11, R10)', () => {
  it('R11 a remembered library opens without asking anything', async () => {
    const { fake, names } = setup({ remembered: 'D:\\Work\\Library' });
    const parts = await openDesktopParts({ invoke: fake.invoke });
    expect(names).toEqual(['library_open']);
    expect(parts.location.path).toBe('D:\\Work\\Library');
  });

  it('R11 first start asks nothing: no dialog opens and the default folder is used', async () => {
    const { fake, names } = setup({ remembered: null });
    const parts = await openDesktopParts({ invoke: fake.invoke });
    expect(names).toEqual(['library_open', 'library_use_default']);
    expect(names).not.toContain('library_choose');
    expect(parts.location.path).toBe('C:\\Users\\Someone\\Texturium');
  });

  it('R14 a library that cannot be opened (held by another copy, folder missing) fails with the Rust kind, so the entry can say so', async () => {
    const { fake } = setup({ remembered: null, openFails: { kind: 'busy', message: 'This library is in use by another copy of the app.' } });
    await expect(openDesktopParts({ invoke: fake.invoke })).rejects.toMatchObject({ name: 'BridgeError', kind: 'busy', message: 'This library is in use by another copy of the app.' });
  });
});

describe('the parts a desktop app is made of (storage-backends R4, R5, R10)', () => {
  it('R5 records go to the record store, files under the library, and the vault in the app data folder', async () => {
    const { fake } = setup({ remembered: 'D:\\Lib' });
    const parts = await openDesktopParts({ invoke: fake.invoke });
    expect((await parts.blobs.put('p1', 'model.glb', new Blob([Uint8Array.of(1)]))).ok).toBe(true);
    expect([...(await readFile(join(library, 'projects', 'p1', 'files', 'model.glb')))]).toEqual([1]);
    expect(await parts.vaultStorage.load()).toBeNull();
    expect(await parts.vaultStorage.save(sampleVaultRecord(), null)).toBe('saved');
    expect(JSON.parse(await readFile(join(appdata, 'vault.json'), 'utf8')).version).toBe(1);
    expect(parts.engine).toBeDefined();
  });

  it('R10 the storage numbers come from the library disk\'s free space', async () => {
    const { fake } = setup({ remembered: 'D:\\Lib' });
    const parts = await openDesktopParts({ invoke: fake.invoke });
    const estimate = await parts.storage.estimate?.();
    expect(estimate?.quota).toBeGreaterThan(0);
    expect(await parts.storage.persist?.()).toBe(true);
  });

  it('R10 Show in folder asks Rust to open the library folder', async () => {
    const { fake, names } = setup({ remembered: 'D:\\Lib' });
    const parts = await openDesktopParts({ invoke: fake.invoke });
    await parts.location.showInFolder();
    expect(names).toContain('library_show_in_folder');
  });

  it('R10 Change folder reloads the page after a library was chosen', async () => {
    const reload = vi.fn();
    const { fake } = setup({ remembered: 'D:\\Lib', choices: [{ result: 'chosen', path: 'E:\\Other' }] });
    const parts = await openDesktopParts({ invoke: fake.invoke, reload });
    expect(await parts.location.change()).toBe('changed');
    expect(reload).toHaveBeenCalledTimes(1);
  });

  it('R10 closing the Change folder dialog changes nothing and does not reload', async () => {
    const reload = vi.fn();
    const { fake } = setup({ remembered: 'D:\\Lib', choices: [{ result: 'cancelled' }] });
    const parts = await openDesktopParts({ invoke: fake.invoke, reload });
    expect(await parts.location.change()).toBe('cancelled');
    expect(reload).not.toHaveBeenCalled();
  });

  it('R10 a refused folder in Change folder is returned with its reason for Settings to show, and does not reload', async () => {
    const reload = vi.fn();
    const { fake } = setup({ remembered: 'D:\\Lib', choices: [{ result: 'refused', message: 'The Windows folder cannot be the library.' }] });
    const parts = await openDesktopParts({ invoke: fake.invoke, reload });
    expect(await parts.location.change()).toEqual({ refused: 'The Windows folder cannot be the library.' });
    expect(reload).not.toHaveBeenCalled();
  });
});
