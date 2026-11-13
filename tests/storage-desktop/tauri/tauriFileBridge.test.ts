import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { BridgeError } from '../../../src/storage-desktop/bridgeError';
import { MAX_CHUNK_BYTES } from '../../../src/storage-desktop/FileBridge';
import { createTauriFileBridge } from '../../../src/storage-desktop/tauri/tauriFileBridge';
import { createFakeTauriInvoke } from '../../support/storageDesktop/fakeTauriInvoke';
import { createMemoryRecordBridge } from '../../support/storageDesktop/memoryRecordBridge';
import { createNodeFileBridge } from '../../support/storageDesktop/nodeFileBridge';

let library: string;
let appdata: string;
beforeEach(async () => {
  library = await mkdtemp(join(tmpdir(), 'tauri-lib-'));
  appdata = await mkdtemp(join(tmpdir(), 'tauri-app-'));
});
afterEach(async () => {
  await rm(library, { recursive: true, force: true });
  await rm(appdata, { recursive: true, force: true });
});

function setup() {
  const fake = createFakeTauriInvoke({ records: createMemoryRecordBridge(), library: createNodeFileBridge(library), appdata: createNodeFileBridge(appdata) });
  return { fake, files: createTauriFileBridge(fake.invoke, 'library'), vault: createTauriFileBridge(fake.invoke, 'appdata') };
}

async function collect(chunks: AsyncIterable<Uint8Array> | null): Promise<number[]> {
  const out: number[] = [];
  for await (const piece of chunks ?? []) for (const byte of piece) out.push(byte);
  return out;
}

describe('tauri file bridge (storage-backends R8, R12)', () => {
  it('R8 writes in chunks, shows nothing until commit, then reads the same bytes back', async () => {
    const { files } = setup();
    const writer = await files.write('projects/p1/files/model.bin');
    await writer.chunk(Uint8Array.of(1, 2));
    await writer.chunk(Uint8Array.of(3));
    expect(await files.read('projects/p1/files/model.bin')).toBeNull();
    await writer.commit();
    expect(await collect(await files.read('projects/p1/files/model.bin'))).toEqual([1, 2, 3]);
    expect([...(await readFile(join(library, 'projects', 'p1', 'files', 'model.bin')))]).toEqual([1, 2, 3]);
  });

  it('R8 an aborted write leaves no file', async () => {
    const { files } = setup();
    const writer = await files.write('a.bin');
    await writer.chunk(Uint8Array.of(1));
    await writer.abort();
    expect(await files.read('a.bin')).toBeNull();
  });

  it('R8 a read comes back in pieces no bigger than one chunk, asked for by offset until an empty piece', async () => {
    const { files, fake } = setup();
    const writer = await files.write('big.bin');
    await writer.chunk(new Uint8Array(100).fill(4));
    await writer.commit();
    const maxes = new Set<unknown>();
    const pieces: number[] = [];
    for await (const piece of (await files.read('big.bin'))!) pieces.push(piece.length);
    for (const call of fake.calls.filter((entry) => entry.command === 'file_read_chunk')) maxes.add((call.args as { max: number }).max);
    expect(pieces.reduce((total, size) => total + size, 0)).toBe(100);
    expect([...maxes]).toEqual([MAX_CHUNK_BYTES]);
  });

  it('R8 a missing file reads as null, and the empty file reads as no chunks', async () => {
    const { files } = setup();
    expect(await files.read('nothing.bin')).toBeNull();
    const writer = await files.write('empty.bin');
    await writer.commit();
    expect(await collect(await files.read('empty.bin'))).toEqual([]);
  });

  it('R8 a chunk above the chunk limit is refused before anything crosses', async () => {
    const { files, fake } = setup();
    const writer = await files.write('x.bin');
    await expect(writer.chunk(new Uint8Array(MAX_CHUNK_BYTES + 1))).rejects.toMatchObject({ kind: 'denied' });
    expect(fake.calls.some((call) => call.command === 'file_write_chunk')).toBe(false);
    await writer.abort();
  });

  it('R8 chunks carry their write and folder in headers and the bytes as the body', async () => {
    const { files, fake } = setup();
    const writer = await files.write('x.bin');
    await writer.chunk(Uint8Array.of(1));
    await writer.abort();
    const chunkCall = fake.calls.find((call) => call.command === 'file_write_chunk')!;
    expect(chunkCall.args).toBeInstanceOf(Uint8Array);
    expect(chunkCall.headers).toMatchObject({ root: 'library' });
    expect(chunkCall.headers?.['id']).toMatch(/^\d+$/);
  });

  it('R5 the app-data bridge works in the app data folder, not the library', async () => {
    const { vault } = setup();
    const writer = await vault.write('vault.json');
    await writer.chunk(Uint8Array.of(9));
    await writer.commit();
    expect([...(await readFile(join(appdata, 'vault.json')))]).toEqual([9]);
  });

  it('R8 removes files and folders, lists entries with kind and size, and an empty folder lists as []', async () => {
    const { files } = setup();
    for (const path of ['d/a.bin', 'd/sub/b.bin']) {
      const writer = await files.write(path);
      await writer.chunk(Uint8Array.of(1, 2));
      await writer.commit();
    }
    expect((await files.list('d')).sort((a, b) => a.name.localeCompare(b.name))).toEqual([{ name: 'a.bin', kind: 'file', size: 2 }, { name: 'sub', kind: 'dir', size: 0 }]);
    await files.remove('d/a.bin', false);
    await files.remove('d', true);
    expect(await files.list('d')).toEqual([]);
    await expect(files.remove('d', true)).resolves.toBeUndefined();
  });

  it('R10 reports free and total space, or null when the disk will not say', async () => {
    const { files } = setup();
    const space = await files.freeSpace();
    expect(space === null || (space.free > 0 && space.total >= space.free)).toBe(true);
    const unknown = createTauriFileBridge(async () => null, 'library');
    expect(await unknown.freeSpace()).toBeNull();
  });

  it('R12 a path the library refuses fails as a denied BridgeError', async () => {
    const { files } = setup();
    await expect(files.write('../escape.bin')).rejects.toBeInstanceOf(BridgeError);
    await expect(files.write('../escape.bin')).rejects.toMatchObject({ kind: 'denied' });
  });
});
