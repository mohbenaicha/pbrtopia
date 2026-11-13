import { randomBytes } from 'node:crypto';
import { mkdir, open, readdir, lstat, rename, rm, rmdir, statfs, unlink } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { BridgeError } from '../../../src/storage-desktop/bridgeError';
import { MAX_CHUNK_BYTES, type FileBridge, type FileWriter } from '../../../src/storage-desktop/FileBridge';

const ILLEGAL = /[<>:"|?*\\\u0000-\u001f]/;
const DEVICE = /^(con|prn|aux|nul|com[1-9]|lpt[1-9])$/i;

/** The rules the Rust side applies to every path it is given (storage-backends R12), written again here on purpose. */
function checkedPath(path: string, allowEmpty = false): string[] {
  if (path === '' && allowEmpty) return [];
  const refuse = (): never => {
    throw new BridgeError('denied', `"${path}" is not a path the library accepts.`);
  };
  if (path === '' || path.startsWith('/') || /^[A-Za-z]:/.test(path)) return refuse();
  const parts = path.split('/');
  for (const part of parts) {
    const stem = part.split('.')[0]!.trimEnd();
    if (part === '' || part === '.' || part === '..' || ILLEGAL.test(part) || /[. ]$/.test(part) || DEVICE.test(stem) || /\.tmp$/i.test(part)) refuse();
  }
  return parts;
}

function fromNode(error: unknown): BridgeError {
  const code = (error as { code?: string }).code;
  if (code === 'ENOSPC') return new BridgeError('no-space', 'The disk is full.');
  if (code === 'EACCES' || code === 'EPERM' || code === 'EROFS') return new BridgeError('denied', 'The folder refuses the write.');
  if (code === 'EBUSY') return new BridgeError('busy', 'The file is in use.');
  return new BridgeError('io', error instanceof Error ? error.message : 'A file operation failed.');
}

async function guarded<T>(work: () => Promise<T>): Promise<T> {
  try {
    return await work();
  } catch (error) {
    throw error instanceof BridgeError ? error : fromNode(error);
  }
}

/** A stand-in for the Rust file commands over a real folder (a temporary one in tests). */
export function createNodeFileBridge(rootFolder: string): FileBridge {
  const absolute = (parts: string[]): string => join(rootFolder, ...parts);

  async function* chunksOf(file: string, size: number): AsyncGenerator<Uint8Array> {
    const handle = await open(file, 'r');
    try {
      const buffer = Buffer.alloc(Math.min(Math.max(size, 1), MAX_CHUNK_BYTES));
      for (;;) {
        const { bytesRead } = await handle.read(buffer, 0, buffer.length, null);
        if (bytesRead === 0) return;
        yield Uint8Array.from(buffer.subarray(0, bytesRead));
      }
    } finally {
      await handle.close();
    }
  }

  return {
    read: (path) =>
      guarded(async () => {
        const file = absolute(checkedPath(path));
        const info = await lstat(file).catch(() => null);
        return info !== null && info.isFile() ? chunksOf(file, info.size) : null;
      }),
    write: (path) =>
      guarded(async (): Promise<FileWriter> => {
        const target = absolute(checkedPath(path));
        await mkdir(dirname(target), { recursive: true });
        const temporary = `${target}.${randomBytes(6).toString('hex')}.tmp`;
        const handle = await open(temporary, 'w');
        let finished = false;
        const requireOpen = (): void => {
          if (finished) throw new BridgeError('io', 'The write is already finished.');
        };
        return {
          chunk: (bytes) =>
            guarded(async () => {
              requireOpen();
              if (bytes.length > MAX_CHUNK_BYTES) throw new BridgeError('io', 'A chunk is larger than the limit.');
              await handle.write(bytes);
            }),
          commit: () =>
            guarded(async () => {
              requireOpen();
              finished = true;
              await handle.sync();
              await handle.close();
              await rename(temporary, target);
            }),
          abort: () =>
            guarded(async () => {
              if (finished) return;
              finished = true;
              await handle.close();
              await unlink(temporary);
            }),
        };
      }),
    remove: (path, recursive) =>
      guarded(async () => {
        const target = absolute(checkedPath(path));
        const info = await lstat(target).catch(() => null);
        if (info === null) return;
        if (!info.isDirectory()) return unlink(target);
        if (recursive) return rm(target, { recursive: true, force: true });
        return rmdir(target);
      }),
    list: (path) =>
      guarded(async () => {
        const folder = absolute(checkedPath(path, true));
        const entries = await readdir(folder, { withFileTypes: true }).catch(() => null);
        if (entries === null) return [];
        const listed = [];
        for (const entry of entries) {
          if (/\.tmp$/i.test(entry.name)) continue;
          const isDirectory = entry.isDirectory();
          listed.push({ name: entry.name, kind: isDirectory ? ('dir' as const) : ('file' as const), size: isDirectory ? 0 : (await lstat(join(folder, entry.name))).size });
        }
        return listed;
      }),
    freeSpace: () =>
      guarded(async () => {
        const space = await statfs(rootFolder);
        return { free: Number(space.bavail) * space.bsize, total: Number(space.blocks) * space.bsize };
      }),
  };
}
