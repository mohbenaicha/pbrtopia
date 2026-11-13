import { mkdtemp, readdir, readFile, rm, writeFile, mkdir } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { BridgeError } from '../../../src/storage-desktop/bridgeError';
import { MAX_CHUNK_BYTES } from '../../../src/storage-desktop/FileBridge';
import { createNodeFileBridge } from './nodeFileBridge';

let root: string;
beforeEach(async () => void (root = await mkdtemp(join(tmpdir(), 'file-bridge-'))));
afterEach(async () => rm(root, { recursive: true, force: true }));

const text = (value: string): Uint8Array => new TextEncoder().encode(value);
async function readAll(chunks: AsyncIterable<Uint8Array> | null): Promise<string | null> {
  if (chunks === null) return null;
  const parts: Uint8Array[] = [];
  for await (const chunk of chunks) parts.push(chunk);
  return new TextDecoder().decode(Buffer.concat(parts));
}
async function writeWhole(bridge: ReturnType<typeof createNodeFileBridge>, path: string, value: string): Promise<void> {
  const writer = await bridge.write(path);
  await writer.chunk(text(value));
  await writer.commit();
}

describe('createNodeFileBridge (a faithful stand-in for the Rust file commands, storage-backends R8, R12)', () => {
  it('R8 a written file is read back whole, folders are created, and a missing file reads as null', async () => {
    const bridge = createNodeFileBridge(root);
    await writeWhole(bridge, 'projects/p1/files/textures/a.png', 'hello ');
    expect(await readAll(await bridge.read('projects/p1/files/textures/a.png'))).toBe('hello ');
    expect(await bridge.read('projects/p1/files/none.png')).toBeNull();
  });

  it('R8 the target is untouched until commit, and an abort leaves nothing behind', async () => {
    const bridge = createNodeFileBridge(root);
    await writeWhole(bridge, 'p/a.bin', 'old');
    const writer = await bridge.write('p/a.bin');
    await writer.chunk(text('new but not yet'));
    expect(await readAll(await bridge.read('p/a.bin'))).toBe('old');
    await writer.abort();
    expect(await readAll(await bridge.read('p/a.bin'))).toBe('old');
    expect(await readdir(join(root, 'p'))).toEqual(['a.bin']);
    const second = await bridge.write('p/a.bin');
    await second.chunk(text('replaced'));
    await second.commit();
    expect(await readAll(await bridge.read('p/a.bin'))).toBe('replaced');
    expect(await readdir(join(root, 'p'))).toEqual(['a.bin']);
  });

  it('R8 a chunk above the limit is refused, and a writer that is finished takes no more', async () => {
    const bridge = createNodeFileBridge(root);
    const writer = await bridge.write('p/big.bin');
    await expect(writer.chunk(new Uint8Array(MAX_CHUNK_BYTES + 1))).rejects.toBeInstanceOf(BridgeError);
    await writer.abort();
    await expect(writer.chunk(text('x'))).rejects.toBeInstanceOf(BridgeError);
  });

  it('R8 a file bigger than one chunk is read back in chunks of at most the limit', async () => {
    const bridge = createNodeFileBridge(root);
    await mkdir(join(root, 'p'));
    await writeFile(join(root, 'p', 'big.bin'), new Uint8Array(MAX_CHUNK_BYTES * 2 + 5));
    const sizes: number[] = [];
    for await (const chunk of (await bridge.read('p/big.bin'))!) sizes.push(chunk.length);
    expect(sizes.reduce((a, b) => a + b, 0)).toBe(MAX_CHUNK_BYTES * 2 + 5);
    expect(Math.max(...sizes)).toBeLessThanOrEqual(MAX_CHUNK_BYTES);
  });

  it('R8 list gives names, kinds and sizes of one folder, nothing for a missing one, and never shows temporary files', async () => {
    const bridge = createNodeFileBridge(root);
    await writeWhole(bridge, 'p/a.txt', 'abc');
    await writeWhole(bridge, 'p/sub/b.txt', 'x');
    const open = await bridge.write('p/c.txt');
    await open.chunk(text('half'));
    const listed = (await bridge.list('p')).sort((a, b) => a.name.localeCompare(b.name));
    expect(listed).toEqual([
      { name: 'a.txt', kind: 'file', size: 3 },
      { name: 'sub', kind: 'dir', size: 0 },
    ]);
    expect(await bridge.list('nowhere')).toEqual([]);
    await open.abort();
  });

  it('R8 remove succeeds when the target is absent; a folder needs recursive', async () => {
    const bridge = createNodeFileBridge(root);
    await writeWhole(bridge, 'p/sub/a.txt', 'x');
    await expect(bridge.remove('p/nothing', false)).resolves.toBeUndefined();
    await expect(bridge.remove('p/sub', false)).rejects.toBeInstanceOf(BridgeError);
    await bridge.remove('p/sub/a.txt', false);
    await bridge.remove('p', true);
    expect(await bridge.list('p')).toEqual([]);
  });

  it('R12 paths that are absolute, climb out, use a backslash, an empty part, an illegal part, a device name or the temporary suffix are refused with "denied"', async () => {
    const bridge = createNodeFileBridge(root);
    const refused = ['/abs/a.txt', 'C:/x/a.txt', '../a.txt', 'a/../../b.txt', 'a\\b.txt', 'a//b.txt', 'a/b:c.txt', 'a/CON', 'a/nul.txt', 'a/name.', 'a/x.tmp', ''];
    for (const path of refused) {
      await expect(bridge.write(path), `write ${path}`).rejects.toMatchObject({ kind: 'denied' });
      await expect(bridge.read(path), `read ${path}`).rejects.toMatchObject({ kind: 'denied' });
      await expect(bridge.remove(path, true), `remove ${path}`).rejects.toMatchObject({ kind: 'denied' });
    }
    expect(await readdir(root)).toEqual([]);
  });

  it('R8 free space is reported for the root', async () => {
    const space = await createNodeFileBridge(root).freeSpace();
    expect(space === null || (space.free >= 0 && space.total >= space.free)).toBe(true);
    expect(space).not.toBeNull();
  });

  it('R8 a file already there is replaced by whole content, never mixed with the old', async () => {
    const bridge = createNodeFileBridge(root);
    await writeFile(join(root, 'old.txt'), 'old old old old');
    await writeWhole(bridge, 'old.txt', 'new');
    expect(await readFile(join(root, 'old.txt'), 'utf8')).toBe('new');
  });
});
