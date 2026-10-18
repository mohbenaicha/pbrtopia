import { describe, expect, it, vi } from 'vitest';
import { runCameraTransition } from '../../src/viewport/cameraTransition';

function createManualClock() {
  let time = 0;
  let next = 1;
  const pending = new Map<number, () => void>();
  return {
    now: (): number => time,
    requestAnimationFrame: (callback: () => void): number => {
      pending.set(next, callback);
      return next++;
    },
    cancelAnimationFrame: (handle: number): void => {
      pending.delete(handle);
    },
    advance(ms: number): void {
      time += ms;
      const callbacks = [...pending.values()];
      pending.clear();
      callbacks.forEach((callback) => callback());
    },
    pendingFrames: (): number => pending.size,
  };
}

describe('cameraTransition', () => {
  it('R13 it steps from 0 to exactly 1 over the duration, easing, and then stops asking for frames', () => {
    const clock = createManualClock();
    const steps: number[] = [];
    runCameraTransition((progress) => steps.push(progress), { durationMs: 200, reducedMotion: false, clock });
    clock.advance(100);
    clock.advance(100);
    expect(steps[0]).toBeGreaterThan(0);
    expect(steps[0]).toBeLessThan(1);
    expect(steps[steps.length - 1]).toBe(1);
    expect(steps).toEqual([...steps].sort((a, b) => a - b));
    expect(clock.pendingFrames()).toBe(0);
  });

  it('R13 with reduced motion it jumps straight to 1 without waiting for a frame', () => {
    const clock = createManualClock();
    const step = vi.fn();
    runCameraTransition(step, { durationMs: 200, reducedMotion: true, clock });
    expect(step).toHaveBeenCalledTimes(1);
    expect(step).toHaveBeenCalledWith(1);
    expect(clock.pendingFrames()).toBe(0);
  });

  it('R13 cancelling stops it where it is', () => {
    const clock = createManualClock();
    const step = vi.fn();
    const cancel = runCameraTransition(step, { durationMs: 200, reducedMotion: false, clock });
    clock.advance(50);
    const calls = step.mock.calls.length;
    cancel();
    clock.advance(500);
    expect(step.mock.calls.length).toBe(calls);
    expect(clock.pendingFrames()).toBe(0);
  });
});
