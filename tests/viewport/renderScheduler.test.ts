import { describe, expect, it, vi } from 'vitest';
import { createRenderScheduler } from '../../src/viewport/renderScheduler';

// A frame clock the test advances by hand.
function createManualClock() {
  let next = 1;
  const pending = new Map<number, () => void>();
  return {
    requestAnimationFrame: (callback: () => void): number => {
      pending.set(next, callback);
      return next++;
    },
    cancelAnimationFrame: (handle: number): void => {
      pending.delete(handle);
    },
    pendingFrames: (): number => pending.size,
    tick: (): void => {
      const callbacks = [...pending.values()];
      pending.clear();
      callbacks.forEach((callback) => callback());
    },
  };
}

describe('renderScheduler', () => {
  it('R18 many invalidate calls before a frame give one draw', () => {
    const clock = createManualClock();
    const draw = vi.fn();
    const scheduler = createRenderScheduler(draw, clock);
    scheduler.invalidate();
    scheduler.invalidate();
    scheduler.invalidate();
    expect(draw).not.toHaveBeenCalled();
    clock.tick();
    expect(draw).toHaveBeenCalledTimes(1);
  });

  it('R18 an idle viewport requests no frames', () => {
    const clock = createManualClock();
    const draw = vi.fn();
    const scheduler = createRenderScheduler(draw, clock);
    expect(clock.pendingFrames()).toBe(0);
    scheduler.invalidate();
    clock.tick();
    expect(clock.pendingFrames()).toBe(0);
    clock.tick();
    expect(draw).toHaveBeenCalledTimes(1);
  });

  it('R18 an invalidate made while drawing asks for the next frame', () => {
    const clock = createManualClock();
    let remaining = 2;
    const scheduler = createRenderScheduler(() => {
      if (remaining-- > 0) scheduler.invalidate();
    }, clock);
    scheduler.invalidate();
    clock.tick();
    expect(clock.pendingFrames()).toBe(1);
    clock.tick();
    expect(clock.pendingFrames()).toBe(1);
    clock.tick();
    expect(clock.pendingFrames()).toBe(0);
  });

  it('R18 while paused nothing is drawn, and resume draws once', () => {
    const clock = createManualClock();
    const draw = vi.fn();
    const scheduler = createRenderScheduler(draw, clock);
    scheduler.invalidate();
    scheduler.pause();
    expect(clock.pendingFrames()).toBe(0);
    scheduler.invalidate();
    clock.tick();
    expect(draw).not.toHaveBeenCalled();
    scheduler.resume();
    clock.tick();
    expect(draw).toHaveBeenCalledTimes(1);
  });

  it('R18 dispose cancels the pending frame and ignores later invalidates', () => {
    const clock = createManualClock();
    const draw = vi.fn();
    const scheduler = createRenderScheduler(draw, clock);
    scheduler.invalidate();
    scheduler.dispose();
    scheduler.invalidate();
    clock.tick();
    expect(draw).not.toHaveBeenCalled();
    expect(clock.pendingFrames()).toBe(0);
  });
});
