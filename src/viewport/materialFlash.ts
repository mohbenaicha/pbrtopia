import type { Material } from 'three';
import type { FrameClock } from './renderScheduler';

const FLASH_COUNT = 3;
const PULSE_MS = 600; // one pulse: the opacity rises from 0 to 1 and falls back to 0, slowly enough to follow

interface MaterialFlash {
  start(material: Material): Promise<void>; // resolves when the pulses are over or were replaced or cancelled
  cancel(): void;
  dispose(): void;
}

interface MaterialFlashOptions {
  show: (material: Material | null) => void; // the material is laid over the look and its opacity changes between calls; null takes it away
  clock?: FrameClock;
  now?: () => number;
}

// Pulses a translucent material over the model three times by moving its opacity. Frames run only while a flash is going, and a late
// frame skips ahead to where the timeline is.
export function createMaterialFlash({ show, clock = window, now = () => performance.now() }: MaterialFlashOptions): MaterialFlash {
  let running: { material: Material; startedAt: number; finish: () => void } | undefined;
  let frame: number | undefined;

  const stopFrames = (): void => {
    if (frame !== undefined) clock.cancelAnimationFrame(frame);
    frame = undefined;
  };

  const end = (restoreLook: boolean): void => {
    const finished = running;
    if (!finished) return;
    stopFrames();
    finished.material.opacity = 0;
    if (restoreLook) show(null);
    running = undefined;
    finished.finish();
  };

  const tick = (): void => {
    frame = undefined;
    if (!running) return;
    const elapsed = now() - running.startedAt;
    if (elapsed >= FLASH_COUNT * PULSE_MS) {
      end(true);
      return;
    }
    running.material.opacity = Math.min(1, Math.max(0, 0.5 - 0.5 * Math.cos((2 * Math.PI * elapsed) / PULSE_MS)));
    show(running.material);
    frame = clock.requestAnimationFrame(tick);
  };

  return {
    start(material) {
      // A new flash takes over from the one running; the look is not restored in between.
      const previous = running;
      if (previous) {
        stopFrames();
        previous.material.opacity = 0;
        running = undefined;
        previous.finish();
      }
      return new Promise<void>((resolve) => {
        material.opacity = 0;
        running = { material, startedAt: now(), finish: resolve };
        show(material);
        frame = clock.requestAnimationFrame(tick);
      });
    },
    cancel: () => end(true),
    dispose: () => end(true),
  };
}
