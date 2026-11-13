import { mkdtemp, readdir, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { createDesktopBlobStore } from '../../src/storage-desktop/desktopBlobStore';
import { BridgeError } from '../../src/storage-desktop/bridgeError';
import { MAX_CHUNK_BYTES, type FileBridge } from '../../src/storage-desktop/FileBridge';
import { createNodeFileBridge } from '../support/storageDesktop/nodeFileBridge';

let root: string;
beforeEach(async () => void (root = await mkdtemp(join(tmpdir(), 'desktop-blobs-'))));
afterEach(async () => rm(root, { recursive: true, force: true }));

const blobOf = (...values: number[]): Blob => new Blob([Uint8Array.from(values)]);
const bytesOf = async (blob: Blob | null): Promise<number[] | null> => (blob === null ? null : [...new Uint8Array(await blob.arrayBuffer())]);

describe('desktop BlobStore: where files go (storage-backends R5, R6)', () => {
  it('R5 a blob is the file projects/<id>/files/<key> under its real name, and reads back as the same bytes', async () => {
    const store = createDesktopBlobStore(createNodeFileBridge(root));
    expect((await store.put('p1', 'textures/Body-albedo.png', blobOf(1, 2, 3))).ok).toBe(true);
    expect([...(await readFile(join(root, 'projects', 'p1', 'files', 'textures', 'Body-albedo.png')))]).toEqual([1, 2, 3]);
    expect(await bytesOf(await store.get('p1', 'textures/Body-albedo.png'))).toEqual([1, 2, 3]);
  });

  it('R6 a key with characters Windows forbids is stored under its escaped name and listed by its real key', async () => {
    const store = createDesktopBlobStore(createNodeFileBridge(root));
    await store.put('p1', 'tex/a:b?.png', blobOf(7));
    expect(await readdir(join(root, 'projects', 'p1', 'files', 'tex'))).toEqual(['a%3Ab%3F.png']);
    expect(await store.list('p1')).toEqual(['tex/a:b?.png']);
    expect(await bytesOf(await store.get('p1', 'tex/a:b?.png'))).toEqual([7]);
  });

  it('R6 two keys that differ only in capitals are refused as "corrupt" and the first stays', async () => {
    const store = createDesktopBlobStore(createNodeFileBridge(root));
    await store.put('p1', 'Tex/A.png', blobOf(1));
    const clash = await store.put('p1', 'tex/a.png', blobOf(2));
    expect(clash).toMatchObject({ ok: false, error: { code: 'corrupt' } });
    expect(await store.list('p1')).toEqual(['Tex/A.png']);
    expect((await store.put('p1', 'Tex/A.png', blobOf(3))).ok).toBe(true); // the same key again is a rewrite
    expect(await bytesOf(await store.get('p1', 'Tex/A.png'))).toEqual([3]);
  });

  it('R6 keys that end in .tmp or name a Windows device still round-trip', async () => {
    const store = createDesktopBlobStore(createNodeFileBridge(root));
    await store.put('p1', 'a/model.tmp', blobOf(1));
    await store.put('p1', 'con/nul.png', blobOf(2));
    expect(await store.list('p1')).toEqual(['a/model.tmp', 'con/nul.png']);
    expect(await bytesOf(await store.get('p1', 'con/nul.png'))).toEqual([2]);
  });
});

describe('desktop BlobStore: chunks and failures (storage-backends R8, R9)', () => {
  it('R8 a blob over 8 MB reaches the file in pieces of at most 8 MB and reads back whole', async () => {
    const inner = createNodeFileBridge(root);
    const sizes: number[] = [];
    const bridge: FileBridge = {
      ...inner,
      write: async (path) => {
        const writer = await inner.write(path);
        return { ...writer, chunk: (bytes) => (sizes.push(bytes.length), writer.chunk(bytes)) };
      },
    };
    const store = createDesktopBlobStore(bridge);
    const big = new Uint8Array(MAX_CHUNK_BYTES * 2 + 5).map((_, i) => i % 251);
    expect((await store.put('p1', 'big.bin', new Blob([big]))).ok).toBe(true);
    expect(sizes).toEqual([MAX_CHUNK_BYTES, MAX_CHUNK_BYTES, 5]);
    const back = await store.get('p1', 'big.bin');
    expect(back?.size).toBe(big.length);
    expect(new Uint8Array(await back!.arrayBuffer())[MAX_CHUNK_BYTES + 12]).toBe((MAX_CHUNK_BYTES + 12) % 251);
  });

  it('R8 an empty blob is stored as an empty file', async () => {
    const store = createDesktopBlobStore(createNodeFileBridge(root));
    expect((await store.put('p1', 'empty.bin', new Blob([]))).ok).toBe(true);
    expect((await store.get('p1', 'empty.bin'))?.size).toBe(0);
  });

  it('R8 a write that fails part way aborts the file, so the old contents stay and no half file is left', async () => {
    const inner = createNodeFileBridge(root);
    const store = createDesktopBlobStore(inner);
    await store.put('p1', 'a.bin', blobOf(1, 1, 1));
    const failing: FileBridge = {
      ...inner,
      write: async (path) => {
        const writer = await inner.write(path);
        return { ...writer, chunk: () => Promise.reject(new BridgeError('no-space', 'full')) };
      },
    };
    const result = await createDesktopBlobStore(failing).put('p1', 'a.bin', blobOf(9, 9, 9));
    expect(result).toMatchObject({ ok: false, error: { code: 'quota-exceeded' } });
    expect(await bytesOf(await store.get('p1', 'a.bin'))).toEqual([1, 1, 1]);
    expect(await readdir(join(root, 'projects', 'p1', 'files'))).toEqual(['a.bin']);
  });

  it('R9 a denied or busy folder is "storage-unavailable"; a new key whose write fails leaves nothing behind', async () => {
    const inner = createNodeFileBridge(root);
    const failing: FileBridge = {
      ...inner,
      write: async (path) => {
        const writer = await inner.write(path);
        return { ...writer, commit: () => Promise.reject(new BridgeError('busy', 'in use')) };
      },
    };
    const result = await createDesktopBlobStore(failing).put('p1', 'new.bin', blobOf(5));
    expect(result).toMatchObject({ ok: false, error: { code: 'storage-unavailable' } });
    expect(await createDesktopBlobStore(inner).list('p1')).toEqual([]);
  });
});
