import { Zip, ZipDeflate, ZipPassThrough } from 'fflate';
import { storeFailure, type StoreResult } from '../storeError';

// Writes a list of files as a zip into a stream, a chunk at a time. Shared by every app's project export.

export interface ZipFileEntry {
  path: string;
  size: number;
  deflate: boolean; // false for files that are already compressed (stored as they are)
  content: Uint8Array | Blob;
}

const CHUNK_BYTES = 64 * 1024;
const STORED_AS_IS = /\.(png|jpe?g)$/i; // already compressed

export const encodeJsonBytes = (value: unknown): Uint8Array => new TextEncoder().encode(JSON.stringify(value));
export const isDeflatable = (path: string): boolean => !STORED_AS_IS.test(path);

async function* chunksOf(content: Uint8Array | Blob): AsyncGenerator<Uint8Array> {
  if (content instanceof Blob) {
    const reader = content.stream().getReader();
    for (;;) {
      const { done, value } = await reader.read();
      if (done) return;
      yield value;
    }
  }
  for (let at = 0; at < content.byteLength; at += CHUNK_BYTES) yield content.subarray(at, at + CHUNK_BYTES);
}

/**
 * Streams the entries as a zip into `sink`, one chunk at a time and waiting for the sink between chunks, then closes it.
 * `onProgress(done, total)` counts entries. A failure aborts the sink and comes back as `aborted`.
 */
export async function streamZipEntries(entries: readonly ZipFileEntry[], sink: WritableStream<Uint8Array>, onProgress?: (done: number, total: number) => void): Promise<StoreResult<void>> {
  const writer = sink.getWriter();
  let sinkFailure: unknown;
  const written: Promise<void>[] = [];
  const zip = new Zip((error, chunk) => {
    if (error) sinkFailure = error;
    else written.push(writer.write(chunk).catch((cause: unknown) => void (sinkFailure ??= cause)));
  });
  try {
    for (const [index, entry] of entries.entries()) {
      const file = entry.deflate ? new ZipDeflate(entry.path, { level: 6 }) : new ZipPassThrough(entry.path);
      zip.add(file);
      for await (const chunk of chunksOf(entry.content)) {
        file.push(chunk, false);
        await writer.ready;
        if (sinkFailure !== undefined) throw sinkFailure;
      }
      file.push(new Uint8Array(0), true);
      onProgress?.(index + 1, entries.length);
    }
    zip.end();
    await Promise.all(written);
    if (sinkFailure !== undefined) throw sinkFailure;
    await writer.close();
    return { ok: true, value: undefined };
  } catch {
    await writer.abort().catch(() => undefined);
    return storeFailure('aborted', 'The zip could not be written.');
  }
}
