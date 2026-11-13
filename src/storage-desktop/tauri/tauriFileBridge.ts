import { BridgeError } from '../bridgeError';
import { MAX_CHUNK_BYTES, type FileBridge, type FileWriter } from '../FileBridge';
import { guarded } from './tauriFailure';
import type { TauriInvoke } from './tauriInvoke';
import { decodeOptionalBytes } from './wireFrames';

/** Which folder Rust works in: the library, or the app's data folder (where only `vault.json` is allowed, storage-backends R5). */
export type FileRoot = 'library' | 'appdata';

interface ListedFile {
  name: string;
  kind: 'file' | 'dir';
  size: number;
}

/**
 * The files (storage-backends R8, R12) as the `file_*` commands. Reads ask for one chunk at a time by offset, so the page holds one chunk
 * besides what it already has; writes send chunks as raw bodies with the write's id in a header.
 */
export function createTauriFileBridge(invoke: TauriInvoke, root: FileRoot): FileBridge {
  const readChunk = (path: string, offset: number): Promise<Uint8Array | null> =>
    guarded(async () => decodeOptionalBytes(await invoke('file_read_chunk', { root, path, offset, max: MAX_CHUNK_BYTES })));

  return {
    async read(path) {
      const first = await readChunk(path, 0);
      if (first === null) return null;
      return {
        async *[Symbol.asyncIterator]() {
          let piece: Uint8Array | null = first;
          let offset = 0;
          while (piece !== null && piece.length > 0) {
            yield piece;
            offset += piece.length;
            piece = await readChunk(path, offset);
          }
        },
      };
    },

    async write(path): Promise<FileWriter> {
      const id = await guarded(async () => (await invoke('file_write_begin', { root, path })) as number);
      return {
        async chunk(bytes) {
          if (bytes.length > MAX_CHUNK_BYTES) throw new BridgeError('denied', 'That piece is larger than one chunk may be.');
          await guarded(() => invoke('file_write_chunk', bytes, { headers: { root, id: String(id) } }));
        },
        commit: () => guarded(async () => void (await invoke('file_write_commit', { root, id }))),
        abort: () => guarded(async () => void (await invoke('file_write_abort', { root, id }))),
      };
    },

    remove: (path, recursive) => guarded(async () => void (await invoke('file_remove', { root, path, recursive }))),

    list: (path) => guarded(async () => (await invoke('file_list', { path })) as ListedFile[]),

    freeSpace: () => guarded(async () => (await invoke('file_free_space')) as { free: number; total: number } | null),
  };
}
