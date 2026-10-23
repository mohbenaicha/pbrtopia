import { storeFailure, type StoreError, type StoreResult } from '../storeError';

export interface SaveEntry<T> {
  key: string; // names one record or tile: 'project', 'set:<id>', 'tile:<setId>:<n>'
  value: T;
}

interface DebouncedSaverOptions<T> {
  write(entries: SaveEntry<T>[]): Promise<StoreResult<void>>;
  onFailure?(error: StoreError): void;
  delayMs?: number; // the least time between two writes, 1500 by default
  isSame?(a: T, b: T): boolean; // a value equal to the one last written for its key is not written again
}

export interface DebouncedSaver<T> {
  queue(key: string, value: T): void;
  flush(): Promise<StoreResult<void>>; // writes what is waiting now (close, tab hide, set exit)
  hasPending(): boolean;
  dispose(): void; // cancels the timer; flush first to keep what is waiting
}

const DEFAULT_DELAY_MS = 1500;

// Plain values (objects, arrays, numbers, strings, booleans, null) and typed arrays, compared by content.
function isSameValue(a: unknown, b: unknown): boolean {
  if (Object.is(a, b)) return true;
  if (typeof a !== 'object' || typeof b !== 'object' || a === null || b === null) return false;
  if (ArrayBuffer.isView(a) || ArrayBuffer.isView(b)) {
    if (!ArrayBuffer.isView(a) || !ArrayBuffer.isView(b) || a.constructor !== b.constructor || a.byteLength !== b.byteLength) return false;
    const bytesA = new Uint8Array(a.buffer, a.byteOffset, a.byteLength);
    const bytesB = new Uint8Array(b.buffer, b.byteOffset, b.byteLength);
    return bytesA.every((byte, index) => byte === bytesB[index]);
  }
  if (Array.isArray(a) !== Array.isArray(b)) return false;
  const keysA = Object.keys(a);
  const keysB = Object.keys(b);
  if (keysA.length !== keysB.length) return false;
  return keysA.every((key) => key in b && isSameValue((a as Record<string, unknown>)[key], (b as Record<string, unknown>)[key]));
}

// Collects edits per key and writes the changed ones together, never more often than every `delayMs` (the first edit after a quiet moment starts the clock).
export function createDebouncedSaver<T>(options: DebouncedSaverOptions<T>): DebouncedSaver<T> {
  const delayMs = options.delayMs ?? DEFAULT_DELAY_MS;
  const isSame = options.isSame ?? ((a: T, b: T) => isSameValue(a, b));
  const waiting = new Map<string, T>(); // insertion order is the order keys were first queued
  const lastWritten = new Map<string, T>();
  let timer: ReturnType<typeof setTimeout> | undefined;
  let running: Promise<StoreResult<void>> = Promise.resolve({ ok: true, value: undefined });
  let disposed = false;
  let active = 0; // flushes asked for and not finished
  let lastEndedAt = -Infinity; // when the last write finished

  const stopTimer = (): void => {
    if (timer !== undefined) clearTimeout(timer);
    timer = undefined;
  };

  const writeWaiting = async (): Promise<StoreResult<void>> => {
    const entries: SaveEntry<T>[] = [];
    for (const [key, value] of waiting) {
      const previous = lastWritten.get(key);
      if (lastWritten.has(key) && isSame(previous as T, value)) waiting.delete(key);
      else entries.push({ key, value });
    }
    if (entries.length === 0) return { ok: true, value: undefined };
    let result: StoreResult<void>;
    try {
      result = await options.write(entries);
    } catch {
      result = storeFailure('storage-unavailable', 'The changes could not be saved.');
    }
    if (result.ok) {
      for (const entry of entries) {
        lastWritten.set(entry.key, entry.value);
        if (waiting.get(entry.key) === entry.value) waiting.delete(entry.key); // a newer value queued meanwhile stays
      }
    } else {
      options.onFailure?.(result.error);
    }
    return result;
  };

  const startTimer = (ms = delayMs): void => {
    // A timer that fires while a write is running is dropped (the write's end starts the next one), and one that fires too soon after a write waits the rest, so two writes are never closer than `delayMs`.
    timer = setTimeout(() => {
      timer = undefined;
      if (active > 0) return;
      const rest = lastEndedAt + delayMs - Date.now();
      if (rest > 0) startTimer(rest);
      else void flush();
    }, ms);
  };

  const flush = (): Promise<StoreResult<void>> => {
    stopTimer();
    active += 1;
    running = running.then(writeWaiting, writeWaiting).then((result) => {
      active -= 1;
      lastEndedAt = Date.now();
      if (result.ok && active === 0 && waiting.size > 0 && timer === undefined && !disposed) startTimer();
      return result;
    });
    return running;
  };

  return {
    queue(key, value) {
      if (disposed) return;
      waiting.set(key, value);
      if (timer === undefined) startTimer();
    },
    flush,
    hasPending: () => waiting.size > 0,
    dispose() {
      disposed = true;
      stopTimer();
    },
  };
}
