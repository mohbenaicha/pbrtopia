import { storeFailure, type StoreResult } from '../projects';
import { saveBlobAsFile } from './saveBlobAsFile';

interface FolderFileHandle {
  createWritable(): Promise<WritableStream<Uint8Array>>;
}

interface FolderHandle {
  getFileHandle(name: string, options?: { create?: boolean }): Promise<FolderFileHandle>;
}

export interface FolderEnvironment {
  showDirectoryPicker?: () => Promise<FolderHandle>;
  saveBlob(blob: Blob, fileName: string): void; // used when there is no directory picker
}

/** A save that went through, failed for this zip only, or failed in a way that makes the rest of the batch pointless (`stopBatch`). */
export type BatchSave<T> = StoreResult<T> | { ok: false; error: { code: 'aborted'; message: string }; stopBatch: true };

/** Writes the zips of one batch: into the folder the user picked once, or as downloaded links where the browser has no directory picker. */
export interface ZipBatchWriter {
  readonly toFolder: boolean;
  save<T>(fileName: string, writeZip: (sink: WritableStream<Uint8Array>) => Promise<StoreResult<T>>): Promise<BatchSave<T>>;
}

const isAbort = (error: unknown): boolean => error instanceof DOMException && error.name === 'AbortError';
const isNotFound = (error: unknown): boolean => error instanceof DOMException && error.name === 'NotFoundError';

/** `fileName` itself when free, else `<stem> (2).<extension>`, `(3)`...; names compare without case, as the file systems we write to do. */
export function uniqueZipName(fileName: string, taken: ReadonlySet<string>): string {
  if (!taken.has(fileName.toLowerCase())) return fileName;
  const dot = fileName.lastIndexOf('.');
  const [stem, extension] = dot <= 0 ? [fileName, ''] : [fileName.slice(0, dot), fileName.slice(dot)];
  for (let n = 2; ; n += 1) {
    const candidate = `${stem} (${n})${extension}`;
    if (!taken.has(candidate.toLowerCase())) return candidate;
  }
}

function browserFolderEnvironment(): FolderEnvironment {
  const picker = (window as unknown as { showDirectoryPicker?: (options: { mode: 'readwrite' }) => Promise<FolderHandle> }).showDirectoryPicker;
  return picker === undefined ? { saveBlob: saveBlobAsFile } : { showDirectoryPicker: () => picker.call(window, { mode: 'readwrite' }), saveBlob: saveBlobAsFile };
}

async function existsInFolder(folder: FolderHandle, name: string): Promise<boolean> {
  try {
    await folder.getFileHandle(name);
    return true;
  } catch (error) {
    if (isNotFound(error)) return false;
    throw error;
  }
}

function folderWriter(folder: FolderHandle): ZipBatchWriter {
  const used = new Set<string>();
  return {
    toFolder: true,
    async save(fileName, writeZip) {
      try {
        let name = uniqueZipName(fileName, used);
        while (await existsInFolder(folder, name)) {
          used.add(name.toLowerCase());
          name = uniqueZipName(fileName, used);
        }
        used.add(name.toLowerCase());
        const sink = await (await folder.getFileHandle(name, { create: true })).createWritable();
        return await writeZip(sink);
      } catch (error) {
        return error instanceof DOMException && (error.name === 'NotAllowedError' || error.name === 'SecurityError')
          ? { ok: false, error: { code: 'aborted', message: 'Could not write to the folder.' }, stopBatch: true }
          : storeFailure('aborted', 'The file could not be written.');
      }
    },
  };
}

function linkWriter(environment: FolderEnvironment): ZipBatchWriter {
  const used = new Set<string>();
  return {
    toFolder: false,
    async save(fileName, writeZip) {
      const name = uniqueZipName(fileName, used);
      used.add(name.toLowerCase());
      const chunks: Uint8Array[] = [];
      const collected = await writeZip(new WritableStream<Uint8Array>({ write: (chunk) => void chunks.push(chunk.slice()) }));
      if (collected.ok) environment.saveBlob(new Blob(chunks as BlobPart[], { type: 'application/zip' }), name);
      return collected;
    },
  };
}

/**
 * Starts a batch of zips (app/projects R17): asks for the folder once where the browser has a directory picker and returns null when the user closes it,
 * so nothing is exported; with no picker the zips go out as downloaded links.
 */
export async function openZipBatchWriter(environment: FolderEnvironment = browserFolderEnvironment()): Promise<ZipBatchWriter | null> {
  if (environment.showDirectoryPicker === undefined) return linkWriter(environment);
  try {
    return folderWriter(await environment.showDirectoryPicker());
  } catch (error) {
    return isAbort(error) ? null : linkWriter(environment); // a picker that cannot open (blocked, unsupported context) falls back to links
  }
}
