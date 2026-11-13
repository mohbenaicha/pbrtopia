import { MAX_CHUNK_BYTES } from '../FileBridge';
import { BridgeError } from '../bridgeError';
import { guarded } from './tauriFailure';
import type { TauriInvoke } from './tauriInvoke';

interface WritableFile {
  createWritable(): Promise<WritableStream<Uint8Array>>;
}

interface PickedFolder {
  getFileHandle(name: string, options?: { create?: boolean }): Promise<WritableFile>;
}

/**
 * The two pickers the shell's zip writers ask for, in the shape of the browser's file pickers but backed by dialogs Rust opens (storage-backends R12, R13).
 * The page only ever holds opaque handles; a closed dialog is an AbortError, a folder Windows will not let the app write to is a NotAllowedError,
 * so the shell's existing handling (cancel is not a failure, the batch stops) applies unchanged.
 */
export interface DesktopPickers {
  showSaveFilePicker(options: { suggestedName: string; types: { description: string; accept: Record<string, string[]> }[] }): Promise<WritableFile>;
  showDirectoryPicker(): Promise<PickedFolder>;
}

const closed = (): DOMException => new DOMException('The dialog was closed.', 'AbortError');

/** A refusal by the desktop side to write there becomes the browser's own NotAllowedError; every other failure stays a BridgeError. */
async function writing<T>(work: () => Promise<T>): Promise<T> {
  try {
    return await guarded(work);
  } catch (error) {
    if (error instanceof BridgeError && error.kind === 'denied') throw new DOMException(error.message, 'NotAllowedError');
    throw error;
  }
}

function writableThrough(invoke: TauriInvoke, handle: string): WritableStream<Uint8Array> {
  return new WritableStream<Uint8Array>({
    async write(bytes) {
      for (let at = 0; at < bytes.length; at += MAX_CHUNK_BYTES) {
        await writing(() => invoke('handle_write_chunk', bytes.subarray(at, at + MAX_CHUNK_BYTES), { headers: { handle } }));
      }
    },
    close: () => writing(async () => void (await invoke('handle_commit', { handle }))),
    abort: () => writing(async () => void (await invoke('handle_abort', { handle }))),
  });
}

export function createTauriDialogs(invoke: TauriInvoke): DesktopPickers {
  let openFolder: string | null = null; // the folder of the batch in progress; handed back when the next batch asks for one
  return {
    async showSaveFilePicker({ suggestedName, types }) {
      const description = types[0]?.description ?? '';
      const handle = (await writing(() => invoke('pick_save_file', { suggestedName, description }))) as string | null;
      if (handle === null) throw closed();
      return { createWritable: async () => writableThrough(invoke, handle) };
    },
    async showDirectoryPicker() {
      if (openFolder !== null) {
        const previous = openFolder;
        openFolder = null;
        await writing(async () => void (await invoke('handle_release', { handle: previous })));
      }
      const folder = (await writing(() => invoke('pick_folder'))) as string | null;
      if (folder === null) throw closed();
      openFolder = folder;
      return {
        async getFileHandle(name, options) {
          if (options?.create !== true) {
            if (!(await writing(() => invoke('handle_folder_has', { handle: folder, name })))) throw new DOMException('No such file.', 'NotFoundError');
            return { createWritable: () => Promise.reject(new DOMException('An existing file cannot be written.', 'NotAllowedError')) };
          }
          const file = (await writing(() => invoke('handle_create_file', { handle: folder, name }))) as string;
          return { createWritable: async () => writableThrough(invoke, file) };
        },
      };
    },
  };
}
