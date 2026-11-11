import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { PREVIEW_DELAY_MS, createPreviewScheduler } from '../../../../src/materialgen/imageops/session/previewScheduler';

beforeEach(() => vi.useFakeTimers());
afterEach(() => vi.useRealTimers());

function deferred<T>(): { promise: Promise<T>; resolve: (value: T) => void } {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((done) => { resolve = done; });
  return { promise, resolve };
}

describe('imageops preview scheduler (R18)', () => {
  it('R18 the delay is 75 ms', () => {
    expect(PREVIEW_DELAY_MS).toBe(75);
  });

  it('R18 five changes within the delay make one render, with the last values', async () => {
    const render = vi.fn(async (values: number) => values * 2);
    const shown: number[] = [];
    const scheduler = createPreviewScheduler<number, number>({ render, show: (result) => shown.push(result) });
    for (const value of [1, 2, 3, 4, 5]) {
      scheduler.request(value);
      await vi.advanceTimersByTimeAsync(10);
    }
    expect(render).not.toHaveBeenCalled();
    await vi.advanceTimersByTimeAsync(PREVIEW_DELAY_MS);
    expect(render).toHaveBeenCalledTimes(1);
    expect(render).toHaveBeenCalledWith(5);
    expect(shown).toEqual([10]);
  });

  it('R18 a render that finishes after a newer change arrived is never shown', async () => {
    const first = deferred<string>();
    const second = deferred<string>();
    const pending = [first, second];
    const render = vi.fn(() => pending.shift()!.promise);
    const shown: string[] = [];
    const scheduler = createPreviewScheduler<number, string>({ render, show: (result) => shown.push(result) });
    scheduler.request(1);
    await vi.advanceTimersByTimeAsync(PREVIEW_DELAY_MS);
    scheduler.request(2); // arrives while the first render is still running
    await vi.advanceTimersByTimeAsync(PREVIEW_DELAY_MS);
    first.resolve('old');
    await vi.advanceTimersByTimeAsync(0);
    expect(shown).toEqual([]);
    second.resolve('new');
    await vi.advanceTimersByTimeAsync(0);
    expect(shown).toEqual(['new']);
  });

  it('R18 a render that finishes with no newer change is shown', async () => {
    const scheduler = createPreviewScheduler<number, string>({ render: async () => 'ok', show: (result) => shown.push(result) });
    const shown: string[] = [];
    scheduler.request(1);
    await vi.advanceTimersByTimeAsync(PREVIEW_DELAY_MS);
    expect(shown).toEqual(['ok']);
  });

  it('R18 cancel drops a waiting request and an unfinished render', async () => {
    const running = deferred<string>();
    const render = vi.fn(() => running.promise);
    const shown: string[] = [];
    const scheduler = createPreviewScheduler<number, string>({ render, show: (result) => shown.push(result) });
    scheduler.request(1);
    scheduler.cancel();
    await vi.advanceTimersByTimeAsync(PREVIEW_DELAY_MS);
    expect(render).not.toHaveBeenCalled();
    scheduler.request(2);
    await vi.advanceTimersByTimeAsync(PREVIEW_DELAY_MS);
    scheduler.cancel();
    running.resolve('late');
    await vi.advanceTimersByTimeAsync(0);
    expect(shown).toEqual([]);
  });

  it('R18 a failed render is reported once and later requests still work', async () => {
    const errors: unknown[] = [];
    let calls = 0;
    const scheduler = createPreviewScheduler<number, string>({
      render: async () => {
        calls += 1;
        if (calls === 1) throw new Error('lost context');
        return 'fine';
      },
      show: (result) => shown.push(result),
      fail: (error) => errors.push(error),
    });
    const shown: string[] = [];
    scheduler.request(1);
    await vi.advanceTimersByTimeAsync(PREVIEW_DELAY_MS);
    expect(errors).toHaveLength(1);
    scheduler.request(2);
    await vi.advanceTimersByTimeAsync(PREVIEW_DELAY_MS);
    expect(shown).toEqual(['fine']);
  });

  it('R18 a render is not started while another is running; the newest values run after it', async () => {
    const first = deferred<string>();
    const render = vi.fn((values: number) => (values === 1 ? first.promise : Promise.resolve(`r${values}`)));
    const shown: string[] = [];
    const scheduler = createPreviewScheduler<number, string>({ render, show: (result) => shown.push(result) });
    scheduler.request(1);
    await vi.advanceTimersByTimeAsync(PREVIEW_DELAY_MS);
    scheduler.request(2);
    await vi.advanceTimersByTimeAsync(PREVIEW_DELAY_MS);
    expect(render).toHaveBeenCalledTimes(1); // the second waits: one temporary target means one render at a time (R7)
    first.resolve('r1');
    await vi.advanceTimersByTimeAsync(0);
    expect(render).toHaveBeenCalledTimes(2);
    expect(shown).toEqual(['r2']);
  });
});
