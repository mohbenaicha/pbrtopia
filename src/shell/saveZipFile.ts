import { storeFailure, type StoreResult } from '../projects';
import { saveBlobAsFile } from './saveBlobAsFile';

interface SaveFileHandle {
  createWritable(): Promise<WritableStream<Uint8Array>>;
}

export interface DownloadEnvironment {
  showSaveFilePicker?: (options: { suggestedName: string; types: { description: string; accept: Record<string, string[]> }[] }) => Promise<SaveFileHandle>;
  saveBlob(blob: Blob, fileName: string): void; // used when there is no file picker
}

// App/projects R16: a browser downloads the zip as a link into its download folder; its save picker is not used (it failed silently). The desktop app passes its own environment.
function browserEnvironment(): DownloadEnvironment {
  return { saveBlob: saveBlobAsFile };
}

const isCancel = (error: unknown): boolean => error instanceof DOMException && error.name === 'AbortError';

const RESERVED_DEVICE_NAME = /^(con|prn|aux|nul|com[1-9]|lpt[1-9])(\..*)?$/i;

/**
 * `<name>.<extension>` with the characters a file name cannot hold replaced, trailing dots and spaces dropped and a
 * Windows device name (CON, NUL...) prefixed with an underscore; an empty name becomes `fallback`.
 */
export function zipFileName(projectName: string, extension: string, fallback = 'project'): string {
  const safe = projectName.replace(/[\\/:*?"<>|\u0000-\u001f]/g, '_').trim().replace(/[. ]+$/, '');
  const named = safe === '' ? fallback : safe;
  return `${RESERVED_DEVICE_NAME.test(named) ? '_' : ''}${named}.${extension}`;
}

/**
 * Writes a zip the user keeps: streamed to a file they pick where the environment gives a save picker (the desktop app's native dialog), else collected and downloaded as a link (every browser).
 * `writeZip` fills the sink; cancelling the picker is not a failure and returns `whenCancelled`.
 */
export async function saveZipFile<T>(
  suggestedName: string,
  description: string,
  writeZip: (sink: WritableStream<Uint8Array>) => Promise<StoreResult<T>>,
  whenCancelled: T,
  environment: DownloadEnvironment = browserEnvironment(),
): Promise<StoreResult<T>> {
  if (environment.showSaveFilePicker !== undefined) {
    let sink: WritableStream<Uint8Array>;
    try {
      sink = await (await environment.showSaveFilePicker({ suggestedName, types: [{ description, accept: { 'application/zip': ['.zip'] } }] })).createWritable();
    } catch (error) {
      return isCancel(error) ? { ok: true, value: whenCancelled } : storeFailure('aborted', 'The file could not be created.');
    }
    return writeZip(sink);
  }
  const chunks: Uint8Array[] = [];
  const collected = await writeZip(new WritableStream<Uint8Array>({ write: (chunk) => void chunks.push(chunk.slice()) }));
  if (!collected.ok) return collected;
  environment.saveBlob(new Blob(chunks as BlobPart[], { type: 'application/zip' }), suggestedName);
  return collected;
}
