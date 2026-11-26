import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createDebouncedSaver, type SaveEntry } from '../../../src/projects/autosave/debouncedSaver';
import { flushOnTabHide } from '../../../src/projects/autosave/flushOnTabHide';
import { storeFailure, type StoreResult } from '../../../src/projects/storeError';

beforeEach(() => {
  vi.useFakeTimers();
});
afterEach(() => {
  vi.useRealTimers();
});

const ok: StoreResult<void> = { ok: true, value: undefined };

describe('createDebouncedSaver with pictures (reference-editor D15)', () => {
  it('R17 a value that holds a different Blob is written again, the very same Blob is not', async () => {
    const write = vi.fn(async (): Promise<StoreResult<void>> => ok);
    const saver = createDebouncedSaver<unknown>({ write });
    const first = new Blob(['one']);
    saver.queue('k', { picture: first, width: 4 });
    await saver.flush();
    saver.queue('k', { picture: new Blob(['two']), width: 4 });
    await saver.flush();
    saver.queue('k', { picture: first, width: 4 });
    await saver.flush();
    expect(write).toHaveBeenCalledTimes(3);
    saver.queue('k', { picture: first, width: 4 });
    await saver.flush();
    expect(write).toHaveBeenCalledTimes(3);
  });
});

function setup(options: { results?: StoreResult<void>[] } = {}) {
  const writes: SaveEntry<unknown>[][] = [];
  const results = options.results ?? [];
  const write = vi.fn(async (entries: SaveEntry<unknown>[]): Promise<StoreResult<void>> => {
    writes.push(entries);
    return results.shift() ?? ok;
  });
  const onFailure = vi.fn();
  const saver = createDebouncedSaver<unknown>({ write, onFailure });
  return { saver, write, writes, onFailure };
}

describe('debounced saver', () => {
  it('R4 queue returns at once and nothing is written before 1.5 s', async () => {
    const { saver, write } = setup();
    saver.queue('project', { name: 'a' });
    expect(saver.hasPending()).toBe(true);
    await vi.advanceTimersByTimeAsync(1499);
    expect(write).not.toHaveBeenCalled();
    await vi.advanceTimersByTimeAsync(1);
    expect(write).toHaveBeenCalledTimes(1);
    expect(saver.hasPending()).toBe(false);
  });

  it('R4 edits to one key within the window write the last value once', async () => {
    const { saver, writes } = setup();
    saver.queue('set:s1', { weights: [1] });
    await vi.advanceTimersByTimeAsync(500);
    saver.queue('set:s1', { weights: [2] });
    saver.queue('set:s1', { weights: [3] });
    await vi.advanceTimersByTimeAsync(1000);
    expect(writes).toEqual([[{ key: 'set:s1', value: { weights: [3] } }]]);
  });

  it('R4 steady editing writes once per 1.5 s and never more often', async () => {
    const { saver, write } = setup();
    for (let i = 0; i < 12; i += 1) {
      saver.queue('project', { n: i });
      await vi.advanceTimersByTimeAsync(500);
    }
    expect(write).toHaveBeenCalledTimes(4); // 6 s of edits
  });

  it('R4 a slow write is not followed at once by another: the next one starts 1.5 s after it ends', async () => {
    const starts: number[] = [];
    const ends: number[] = [];
    const write = vi.fn(async (): Promise<StoreResult<void>> => {
      starts.push(Date.now());
      await new Promise((resolve) => setTimeout(resolve, 3500));
      ends.push(Date.now());
      return ok;
    });
    const saver = createDebouncedSaver<unknown>({ write });
    for (let i = 0; i < 30; i += 1) {
      saver.queue('project', { n: i });
      await vi.advanceTimersByTimeAsync(500);
    }
    await vi.advanceTimersByTimeAsync(10000);
    expect(starts.length).toBeGreaterThan(2);
    for (let i = 1; i < starts.length; i += 1) expect(starts[i]! - ends[i - 1]!).toBeGreaterThanOrEqual(1500);
  });

  it('R4 keys are written together in the order they were first queued', async () => {
    const { saver, writes } = setup();
    saver.queue('set:s1', 1);
    saver.queue('tile:s1:4', 2);
    saver.queue('set:s1', 3);
    await vi.advanceTimersByTimeAsync(1500);
    expect(writes[0]!.map((entry) => entry.key)).toEqual(['set:s1', 'tile:s1:4']);
  });

  it('R4 a value equal to the one last written is not written again, for plain values and typed arrays', async () => {
    const { saver, writes } = setup();
    saver.queue('project', { name: 'a', list: [1, { x: 2 }] });
    saver.queue('tile:s:0', new Uint16Array([1, 2, 3]));
    await vi.advanceTimersByTimeAsync(1500);
    saver.queue('project', { name: 'a', list: [1, { x: 2 }] });
    saver.queue('tile:s:0', new Uint16Array([1, 2, 4]));
    await vi.advanceTimersByTimeAsync(1500);
    expect(writes).toHaveLength(2);
    expect(writes[1]!.map((entry) => entry.key)).toEqual(['tile:s:0']);
    saver.queue('project', { name: 'a', list: [1, { x: 2 }] });
    await vi.advanceTimersByTimeAsync(1500);
    expect(writes).toHaveLength(2); // nothing changed, so no write at all
  });

  it('R4 flush writes at once, and with nothing waiting it succeeds without a write', async () => {
    const { saver, write } = setup();
    expect(await saver.flush()).toEqual(ok);
    expect(write).not.toHaveBeenCalled();
    saver.queue('project', 1);
    expect(await saver.flush()).toEqual(ok);
    expect(write).toHaveBeenCalledTimes(1);
    await vi.advanceTimersByTimeAsync(5000);
    expect(write).toHaveBeenCalledTimes(1); // the timer was cancelled by the flush
  });

  it('R4 a flush during a write waits for it and then writes what is waiting; writes never overlap', async () => {
    let finishFirst: (result: StoreResult<void>) => void = () => undefined;
    let running = 0;
    let mostRunning = 0;
    const calls: string[][] = [];
    const write = vi.fn((entries: SaveEntry<unknown>[]) => {
      calls.push(entries.map((entry) => entry.key));
      running += 1;
      mostRunning = Math.max(mostRunning, running);
      const done = (result: StoreResult<void>): StoreResult<void> => {
        running -= 1;
        return result;
      };
      if (calls.length === 1) return new Promise<StoreResult<void>>((resolve) => (finishFirst = (result) => resolve(done(result))));
      return Promise.resolve(done(ok));
    });
    const saver = createDebouncedSaver<unknown>({ write, onFailure: vi.fn() });
    saver.queue('a', 1);
    const firstFlush = saver.flush();
    await vi.advanceTimersByTimeAsync(0); // the first write has started
    saver.queue('b', 2);
    const secondFlush = saver.flush();
    await vi.advanceTimersByTimeAsync(0);
    expect(write).toHaveBeenCalledTimes(1); // the second flush waits for the first write
    finishFirst(ok);
    await firstFlush;
    await secondFlush;
    expect(calls).toEqual([['a'], ['b']]);
    expect(mostRunning).toBe(1);
  });

  it('R4 a failed write keeps its entries, reports the error, starts no timer, and the next queue writes them again', async () => {
    const failure = storeFailure('quota-exceeded', 'Storage is full.');
    const { saver, writes, onFailure } = setup({ results: [failure] });
    saver.queue('project', 1);
    saver.queue('set:s1', 2);
    await vi.advanceTimersByTimeAsync(1500);
    expect(onFailure).toHaveBeenCalledWith(failure.error);
    expect(saver.hasPending()).toBe(true);
    await vi.advanceTimersByTimeAsync(10_000);
    expect(writes).toHaveLength(1); // no retry of its own
    saver.queue('set:s1', 3); // a newer value for a key wins
    await vi.advanceTimersByTimeAsync(1500);
    expect(writes[1]).toEqual([{ key: 'project', value: 1 }, { key: 'set:s1', value: 3 }]);
    expect(saver.hasPending()).toBe(false);
  });

  it('R4 a failed flush returns the failure and a later flush retries', async () => {
    const failure = storeFailure('storage-unavailable', 'No storage.');
    const { saver, write } = setup({ results: [failure] });
    saver.queue('project', 1);
    expect(await saver.flush()).toEqual(failure);
    expect(await saver.flush()).toEqual(ok);
    expect(write).toHaveBeenCalledTimes(2);
  });

  it('R4 a value queued while its write runs is kept for the next write', async () => {
    let finish: (result: StoreResult<void>) => void = () => undefined;
    const calls: unknown[] = [];
    const write = vi.fn((entries: SaveEntry<unknown>[]) => {
      calls.push(entries[0]!.value);
      return calls.length === 1 ? new Promise<StoreResult<void>>((resolve) => (finish = resolve)) : Promise.resolve(ok);
    });
    const saver = createDebouncedSaver<unknown>({ write, onFailure: vi.fn() });
    saver.queue('k', 'old');
    const flushing = saver.flush();
    await vi.advanceTimersByTimeAsync(0);
    saver.queue('k', 'new');
    finish(ok);
    await flushing;
    await saver.flush();
    expect(calls).toEqual(['old', 'new']);
  });

  it('R4 dispose cancels the timer and later queues do nothing', async () => {
    const { saver, write } = setup();
    saver.queue('project', 1);
    saver.dispose();
    saver.queue('project', 2);
    await vi.advanceTimersByTimeAsync(5000);
    expect(write).not.toHaveBeenCalled();
    expect(vi.getTimerCount()).toBe(0);
  });
});

describe('flush on tab hide', () => {
  it('R4 flushes when the page turns hidden, not when it turns visible, and stops when told', () => {
    const target = new EventTarget() as EventTarget & { visibilityState: DocumentVisibilityState };
    target.visibilityState = 'visible';
    const flush = vi.fn(async () => ok);
    const stop = flushOnTabHide({ flush }, target);
    target.dispatchEvent(new Event('visibilitychange'));
    expect(flush).not.toHaveBeenCalled();
    target.visibilityState = 'hidden';
    target.dispatchEvent(new Event('visibilitychange'));
    expect(flush).toHaveBeenCalledTimes(1);
    target.visibilityState = 'visible';
    target.dispatchEvent(new Event('visibilitychange'));
    expect(flush).toHaveBeenCalledTimes(1);
    stop();
    target.visibilityState = 'hidden';
    target.dispatchEvent(new Event('visibilitychange'));
    expect(flush).toHaveBeenCalledTimes(1);
  });
});
