import { describe, expect, it, vi } from 'vitest';
import { watchPixelRatio } from '../../src/viewport/pixelRatio';

// A window whose devicePixelRatio and matchMedia the test controls.
function createFakeWindow(initialRatio: number) {
  const queries: string[] = [];
  const listeners = new Set<() => void>();
  const fake = {
    devicePixelRatio: initialRatio,
    matchMedia: (query: string) => {
      queries.push(query);
      return {
        addEventListener: (_type: 'change', listener: () => void) => listeners.add(listener),
        removeEventListener: (_type: 'change', listener: () => void) => listeners.delete(listener),
      };
    },
  };
  return {
    fake,
    queries,
    activeListeners: (): number => listeners.size,
    changeRatioTo: (ratio: number): void => {
      fake.devicePixelRatio = ratio;
      [...listeners].forEach((listener) => listener());
    },
  };
}

describe('pixelRatio', () => {
  it('R18 a devicePixelRatio change is reported with the new value, then watched again for the next change', () => {
    const win = createFakeWindow(1);
    const onChange = vi.fn();
    watchPixelRatio(onChange, win.fake);
    expect(win.queries).toEqual(['(resolution: 1dppx)']);
    win.changeRatioTo(2);
    expect(onChange).toHaveBeenCalledWith(2);
    expect(win.queries).toEqual(['(resolution: 1dppx)', '(resolution: 2dppx)']);
    win.changeRatioTo(1.5);
    expect(onChange).toHaveBeenLastCalledWith(1.5);
    expect(onChange).toHaveBeenCalledTimes(2);
  });

  it('R18 stopping removes the listener so later changes are not reported', () => {
    const win = createFakeWindow(1);
    const onChange = vi.fn();
    const stop = watchPixelRatio(onChange, win.fake);
    stop();
    expect(win.activeListeners()).toBe(0);
    win.changeRatioTo(2);
    expect(onChange).not.toHaveBeenCalled();
  });
});
