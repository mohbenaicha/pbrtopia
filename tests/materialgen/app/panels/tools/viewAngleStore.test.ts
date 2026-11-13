import { describe, expect, it, vi } from 'vitest';
import { createViewAngleStore } from '@mat/app/panels/tools/viewAngleStore';

describe('materialgen/app viewAngleStore', () => {
  it('R72 it starts at 0 degrees and holds the last angle it was given', () => {
    const store = createViewAngleStore();
    expect(store.get()).toBe(0);
    store.set(90);
    expect(store.get()).toBe(90);
  });

  it('R74 the store knows while a picker is on screen: it is watched from the first picker to the last, and the host hears each change', () => {
    const store = createViewAngleStore();
    const heard = vi.fn();
    store.subscribeWatched(heard);
    expect(store.isWatched()).toBe(false);
    const first = store.watch();
    const second = store.watch();
    expect(store.isWatched()).toBe(true);
    expect(heard).toHaveBeenCalledTimes(1); // only the first picker changes the answer
    first();
    expect(store.isWatched()).toBe(true);
    second();
    second(); // releasing twice does nothing
    expect(store.isWatched()).toBe(false);
    expect(heard).toHaveBeenCalledTimes(2);
  });

  it('R72 R74 subscribers hear a new angle once, and nothing when the angle is the same', () => {
    const store = createViewAngleStore();
    const heard = vi.fn();
    const stop = store.subscribe(heard);
    store.set(30);
    store.set(30);
    expect(heard).toHaveBeenCalledTimes(1);
    stop();
    store.set(60);
    expect(heard).toHaveBeenCalledTimes(1);
  });
});
