import { describe, expect, it, vi } from 'vitest';
import { createBakeQueue } from '@shared/materialMasks';

interface Counter { n: number }

/** A run that the test finishes by hand, so changes can arrive while it is "baking". */
function setup() {
  const releases: Array<() => void> = [];
  const seen: number[] = [];
  let stored: Counter = { n: 0 }; // what the last successful bake saved
  const run = vi.fn(async (value: Counter): Promise<boolean> => {
    seen.push(value.n);
    await new Promise<void>((resolve) => releases.push(resolve));
    stored = value;
    return true;
  });
  const queue = createBakeQueue<Counter>({ read: () => stored, run });
  const finishOne = async (): Promise<void> => {
    await Promise.resolve();
    releases.shift()?.();
    await new Promise((resolve) => setTimeout(resolve, 0));
  };
  return { queue, run, seen, finishOne };
}

describe('materialgen/masks createBakeQueue (masks R58)', () => {
  it('R58 one change runs one bake with the change applied', async () => {
    const { queue, seen, finishOne } = setup();
    const done = queue.submit((value) => ({ n: value.n + 1 }));
    await finishOne();
    expect(await done).toBe(true);
    expect(seen).toEqual([1]);
  });

  it('R58 changes that arrive during a bake are merged into one further bake with the latest values', async () => {
    const { queue, run, seen, finishOne } = setup();
    const first = queue.submit((value) => ({ n: value.n + 1 }));
    await Promise.resolve();
    const second = queue.submit((value) => ({ n: value.n + 10 }));
    const third = queue.submit((value) => ({ n: value.n + 100 }));
    await finishOne(); // the first bake
    await finishOne(); // the merged bake
    expect(await Promise.all([first, second, third])).toEqual([true, true, true]);
    expect(run).toHaveBeenCalledTimes(2);
    expect(seen).toEqual([1, 111]);
  });

  it('R58 never two bakes at once', async () => {
    let running = 0;
    let most = 0;
    const queue = createBakeQueue<Counter>({
      read: () => ({ n: 0 }),
      run: async () => {
        running += 1;
        most = Math.max(most, running);
        await new Promise((resolve) => setTimeout(resolve, 1));
        running -= 1;
        return true;
      },
    });
    await Promise.all([1, 2, 3, 4].map((step) => queue.submit((value) => ({ n: value.n + step }))));
    expect(most).toBe(1);
  });

  it('R70 a bake that fails reports false to every change it carried, and the next change starts from what was stored', async () => {
    let stored = 0;
    let fail = true;
    const queue = createBakeQueue<Counter>({
      read: () => ({ n: stored }),
      run: async (value) => {
        if (fail) return false;
        stored = value.n;
        return true;
      },
    });
    expect(await queue.submit((value) => ({ n: value.n + 5 }))).toBe(false);
    fail = false;
    expect(await queue.submit((value) => ({ n: value.n + 1 }))).toBe(true);
    expect(stored).toBe(1); // the failed +5 is not carried over
  });

  it('R70 a bake that throws counts as failed and does not stop the queue', async () => {
    let calls = 0;
    const queue = createBakeQueue<Counter>({
      read: () => ({ n: 0 }),
      run: async () => {
        calls += 1;
        if (calls === 1) throw new Error('device lost');
        return true;
      },
    });
    expect(await queue.submit((value) => value)).toBe(false);
    expect(await queue.submit((value) => value)).toBe(true);
  });

  it('R58 isBusy says whether a bake is running or waiting', async () => {
    const { queue, finishOne } = setup();
    expect(queue.isBusy()).toBe(false);
    const done = queue.submit((value) => value);
    expect(queue.isBusy()).toBe(true);
    await finishOne();
    await done;
    expect(queue.isBusy()).toBe(false);
  });
});
