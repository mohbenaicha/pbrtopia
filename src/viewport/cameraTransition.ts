import type { FrameClock } from './renderScheduler';

interface TransitionClock extends FrameClock {
  now(): number;
}

interface TransitionOptions {
  durationMs?: number | undefined;
  reducedMotion?: boolean | undefined; // jump straight to the end
  clock?: TransitionClock | undefined;
}

const browserClock: TransitionClock = {
  requestAnimationFrame: (callback) => window.requestAnimationFrame(() => callback()),
  cancelAnimationFrame: (handle) => window.cancelAnimationFrame(handle),
  now: () => performance.now(),
};

const easeInOut = (t: number): number => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);

// Calls step(progress) with eased progress from just above 0 up to exactly 1, one call per animation frame. Returns a function that cancels it where it stands.
export function runCameraTransition(step: (progress: number) => void, options: TransitionOptions = {}): () => void {
  const { durationMs = 220, clock = browserClock } = options;
  const reducedMotion = options.reducedMotion ?? window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  if (reducedMotion) {
    step(1);
    return () => undefined;
  }

  const startedAt = clock.now();
  let handle: number | null = null;
  const frame = (): void => {
    const elapsed = Math.min(1, (clock.now() - startedAt) / durationMs);
    step(elapsed >= 1 ? 1 : easeInOut(elapsed));
    handle = elapsed >= 1 ? null : clock.requestAnimationFrame(frame);
  };
  handle = clock.requestAnimationFrame(frame);
  return () => {
    if (handle !== null) clock.cancelAnimationFrame(handle);
    handle = null;
  };
}
