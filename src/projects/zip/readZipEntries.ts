import { Unzip, UnzipInflate, UnzipPassThrough } from 'fflate';
import { storeFailure, type StoreError } from '../storeError';
import { updateCrc32 } from './crc32';
import { Rejection, shorten } from './zipRejection';
import { ZIP_LIMITS, classifyEntryPath, type EntryKind } from './zipFormat';

const SLICE_BYTES = 16 * 1024; // how much is given to the unzipper at a time, which bounds what one step can unpack
const TAIL_BYTES = 1024 * 1024; // the last bytes kept: the central directory (with its checksums) and the end record

const RANK = { manifest: 0, project: 1, set: 2, tiles: 3, blob: 4 } as const;
const OPTIONAL_REPEAT: ReadonlySet<EntryKind['kind']> = new Set(['set', 'blob']); // the kinds that may come more than once

export interface ZipEntry {
  kind: EntryKind;
  name: string;
  chunks: Uint8Array[];
  size: number;
  crc: number; // CRC-32 of the unpacked bytes
}

export interface ZipReadOutcome {
  failure: StoreError | undefined;
  checksums: Map<string, number>; // the CRC-32 of each entry as streamed, to compare with the zip's own record
  tail: Uint8Array; // the last bytes of the source, where the central directory and the end record must be
  sourceBytes: number;
  open: boolean; // an entry was still being unpacked when the source ended
}

/** The store error a thrown value stands for: a Rejection keeps its own, anything else is `corrupt` with the given reason. */
export function describeFailure(error: unknown, fallback = 'The zip could not be imported.'): StoreError {
  return error instanceof Rejection ? error.storeError : storeFailure('corrupt', typeof error === 'string' ? error : fallback).error;
}

function concatBytes(first: Uint8Array, second: Uint8Array): Uint8Array {
  const bytes = new Uint8Array(first.length + second.length);
  bytes.set(first);
  bytes.set(second, first.length);
  return bytes;
}

/**
 * Streams the source through the unzipper a slice at a time, checks the entry order and limits, and hands each finished entry to `onEntry`
 * (one at a time, before the next slice is unpacked). The first failure, from the zip or from `onEntry`, stops the reading and is returned.
 */
export async function readZipEntries(source: ReadableStream<Uint8Array>, onEntry: (entry: ZipEntry) => Promise<void>): Promise<ZipReadOutcome> {
  let failure: StoreError | undefined;
  const tailChunks: Uint8Array[] = [];
  let tailSize = 0;
  let sourceBytes = 0;
  const checksums = new Map<string, number>();
  let pending: Promise<void> = Promise.resolve();
  let entryCount = 0;
  let lastRank = -1;
  let open = false;
  const seen = new Set<string>();

  const fail = (error: unknown, fallback?: string): void => {
    failure ??= describeFailure(error, fallback);
  };
  const queue = (work: () => Promise<void>): void => {
    pending = pending.then(async () => {
      if (failure) return;
      try {
        await work();
      } catch (error) {
        fail(error);
      }
    });
  };

  const unzip = new Unzip();
  unzip.register(UnzipInflate);
  unzip.register(UnzipPassThrough);
  unzip.onfile = (file) => {
    if (failure) return file.terminate();
    entryCount += 1;
    const kind = classifyEntryPath(file.name);
    if (entryCount > ZIP_LIMITS.maxEntries) fail('The zip has too many entries.');
    else if (kind === null) fail(`The zip has an entry that does not belong: "${shorten(file.name)}".`);
    else if (entryCount === 1 && kind.kind !== 'manifest') fail('The zip does not start with its manifest.');
    else if (RANK[kind.kind] < lastRank || (RANK[kind.kind] === lastRank && !OPTIONAL_REPEAT.has(kind.kind))) fail(`"${shorten(file.name)}" is out of order in the zip.`);
    else if (seen.has(file.name)) fail(`The zip has "${shorten(file.name)}" twice.`);
    if (failure || kind === null) return file.terminate();
    lastRank = RANK[kind.kind];
    seen.add(file.name);
    const cap = kind.kind === 'blob' ? ZIP_LIMITS.maxBlobBytes : ZIP_LIMITS.maxRecordBytes;
    if (file.originalSize !== undefined && file.originalSize > cap) {
      fail(`"${shorten(file.name)}" in the zip is too large.`);
      return file.terminate();
    }
    const entry: ZipEntry = { kind, name: file.name, chunks: [], size: 0, crc: 0 };
    open = true;
    file.ondata = (error, chunk, final) => {
      if (failure) return;
      if (error) return fail('The zip is damaged.');
      entry.size += chunk.length;
      if (entry.size > cap) {
        fail(`"${shorten(file.name)}" in the zip is too large.`);
        return file.terminate();
      }
      entry.chunks.push(chunk);
      entry.crc = updateCrc32(entry.crc, chunk);
      if (final) {
        open = false;
        checksums.set(entry.name, entry.crc);
        queue(() => onEntry(entry));
      }
    };
    try {
      file.start();
    } catch {
      fail('The zip uses a kind of compression that cannot be read.');
    }
  };

  const push = (chunk: Uint8Array, final: boolean): void => {
    try {
      unzip.push(chunk, final);
    } catch {
      fail('This is not a readable zip file.');
    }
  };

  const reader = source.getReader();
  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      sourceBytes += value.length;
      tailChunks.push(value);
      tailSize += value.length;
      while (tailChunks.length > 1 && tailSize - tailChunks[0]!.length >= TAIL_BYTES) tailSize -= tailChunks.shift()!.length;
      for (let at = 0; at < value.length && !failure; at += SLICE_BYTES) {
        push(value.subarray(at, at + SLICE_BYTES), false);
        await pending; // the entries this slice finished are handled before the next slice is unpacked
      }
      if (failure) break;
    }
    if (!failure) {
      push(new Uint8Array(0), true);
      await pending;
    }
  } catch {
    fail('The zip could not be read.');
  } finally {
    await reader.cancel().catch(() => undefined);
  }
  return { failure, checksums, tail: tailChunks.reduce(concatBytes, new Uint8Array(0)).slice(-TAIL_BYTES), sourceBytes, open };
}
