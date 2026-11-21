import { MASKS_PACKAGE_FILES, isTrustedAddress, type PackageFile } from './masksPackageManifest';
import type { PackageCache } from './masksPackageStore';

export interface PackageProgress {
  loaded: number;
  total: number;
}

export type PackageDownloadOutcome = { ok: true } | { ok: false; reason: 'aborted' | 'failed' };

interface DownloadDeps {
  cache: PackageCache;
  files?: readonly PackageFile[];
  fetchFile?: (url: string, init: { signal?: AbortSignal }) => Promise<Response>;
}

interface DownloadOptions {
  signal?: AbortSignal;
  onProgress?: (progress: PackageProgress) => void;
}

async function computeSha256(bytes: Uint8Array): Promise<string> {
  const digest = new Uint8Array(await crypto.subtle.digest('SHA-256', bytes as BufferSource));
  return Array.from(digest, (byte) => byte.toString(16).padStart(2, '0')).join('');
}

async function readBody(response: Response, onChunk: (size: number) => void, signal: AbortSignal | undefined): Promise<Uint8Array> {
  const reader = response.body?.getReader();
  if (reader === undefined) throw new Error('The response has no body.');
  const chunks: Uint8Array[] = [];
  let size = 0;
  for (;;) {
    signal?.throwIfAborted();
    const { done, value } = await reader.read();
    if (done) break;
    chunks.push(value);
    size += value.length;
    onChunk(value.length);
  }
  const bytes = new Uint8Array(size);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.length;
  }
  return bytes;
}

/**
 * Masks-package R3-R5, R8, R9: fetches each file of the package in turn from its trusted address, refuses a final address (after redirects) off the
 * trusted hosts, checks the byte size and the SHA-256, and stores the verified file under its address. A file that fails any check is dropped and
 * the download stops with 'failed'; Cancel (the signal) stops it with 'aborted'. Progress counts the bytes of both files.
 */
export async function downloadMasksPackage(deps: DownloadDeps, options: DownloadOptions): Promise<PackageDownloadOutcome> {
  const files = deps.files ?? MASKS_PACKAGE_FILES;
  const fetchFile = deps.fetchFile ?? ((url, init) => fetch(url, init));
  const { signal, onProgress } = options;
  const total = files.reduce((sum, file) => sum + file.bytes, 0);
  let loaded = 0;
  try {
    if (!files.every((file) => isTrustedAddress(file.url))) return { ok: false, reason: 'failed' };
    for (const file of files) {
      signal?.throwIfAborted();
      const response = await fetchFile(file.url, { ...(signal === undefined ? {} : { signal }) });
      signal?.throwIfAborted();
      if (!response.ok || (response.url !== '' && !isTrustedAddress(response.url))) return { ok: false, reason: 'failed' };
      const before = loaded;
      const bytes = await readBody(response, (size) => { loaded += size; onProgress?.({ loaded, total }); }, signal);
      if (bytes.length !== file.bytes || (await computeSha256(bytes)) !== file.sha256) {
        loaded = before;
        return { ok: false, reason: 'failed' };
      }
      signal?.throwIfAborted();
      await deps.cache.put(file.url, new Response(bytes.buffer as ArrayBuffer));
    }
    onProgress?.({ loaded: total, total });
    return { ok: true };
  } catch {
    return { ok: false, reason: signal?.aborted === true ? 'aborted' : 'failed' };
  }
}
