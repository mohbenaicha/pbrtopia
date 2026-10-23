import type { Material } from 'three';
import type { FrameClock } from './renderScheduler';

const FLASH_COUNT = 3;
const FLASH_PHASE_MS = 150; // each flash is one phase with the material and one without

interface MaterialFlash {
  start(material: Material): Promise<void>; // resolves when the flashes are over or were replaced or cancelled
  cancel(): void;
  dispose(): void;
}

interface MaterialFlashOptions {
  show: (material: Material | null) => void; // null puts the normal look back
  clock?: FrameClock;
  now?: () => number;
}

// Flashes a material over the model three times. Frames run only while a flash is going, and a late frame skips ahead to where the timeline is.
export function createMaterialFlash({ show, clock = window, now = () => performance.now() }: MaterialFlashOptions): MaterialFlash {
  let running: { material: Material; startedAt: number; shown: Material | null; finish: () => void } | undefined;
  let frame: number | undefined;

  const stopFrames = (): void => {
    if (frame !== undefined) clock.cancelAnimationFrame(frame);
    frame = undefined;
  };

  const showOnce = (next: Material | null): void => {
    if (!running || running.shown === next) return;
    running.shown = next;
    show(next);
  };

  const end = (restoreLook: boolean): void => {
    const finished = running;
    if (!finished) return;
    stopFrames();
    if (restoreLook) showOnce(null);
    running = undefined;
    finished.finish();
  };

  const tick = (): void => {
    frame = undefined;
    if (!running) return;
    const phase = Math.floor((now() - running.startedAt) / FLASH_PHASE_MS);
    if (phase >= FLASH_COUNT * 2) {
      end(true);
      return;
    }
    showOnce(phase % 2 === 0 ? running.material : null);
    frame = clock.requestAnimationFrame(tick);
  };

  return {
    start(material) {
      // A new flash takes over from the one running; the look is not restored in between.
      const previous = running;
      if (previous) {
        stopFrames();
        running = undefined;
        previous.finish();
      }
      return new Promise<void>((resolve) => {
        running = { material, startedAt: now(), shown: null, finish: resolve };
        showOnce(material);
        frame = clock.requestAnimationFrame(tick);
      });
    },
    cancel: () => end(true),
    dispose: () => end(true),
  };
}
