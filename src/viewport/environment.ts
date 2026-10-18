import type { Scene, Texture } from 'three';
import type { FrameClock } from './renderScheduler';
import type { ViewportSettings } from './viewportSettings';

export interface EnvironmentEntry {
  light: Texture; // prefiltered, becomes scene.environment
  backdrop: Texture | null; // shown as scene.background when switched on; the built-in studio has none
}

export interface EnvironmentLoader {
  load(id: string): Promise<EnvironmentEntry>;
  dispose(): void; // frees every texture it made
}

export interface Environment {
  applySettings(settings: ViewportSettings): void;
  dispose(): void;
}

export interface EnvironmentOptions {
  scene: Scene;
  loader: EnvironmentLoader;
  invalidate(): void;
  onRotationSettled(degrees: number): void; // auto-rotate was switched off at this angle
  clock?: FrameClock;
  now?: () => number;
}

export const AUTO_ROTATE_DEGREES_PER_SECOND = 14;

const toRadians = (degrees: number): number => (degrees * Math.PI) / 180;

// Keeps the scene's image-based light and backdrop in step with the viewport settings: loads the chosen HDRI once, applies intensity and
// rotation, and spins the light while auto-rotate is on (one animation frame per step, none when off).
export function createEnvironment({ scene, loader, invalidate, onRotationSettled, clock = window, now = () => performance.now() }: EnvironmentOptions): Environment {
  const cache = new Map<string, EnvironmentEntry>();
  let disposed = false;
  let requestedId: string | undefined;
  let shown: EnvironmentEntry | undefined;
  let backgroundVisible = false;
  let spinning = false;
  let angle = 0; // degrees, 0-360
  let lastTick = 0;
  let frame: number | undefined;

  const showBackdrop = (): void => {
    scene.background = backgroundVisible && shown?.backdrop ? shown.backdrop : null;
  };

  const rotateTo = (degrees: number): void => {
    angle = ((degrees % 360) + 360) % 360;
    scene.environmentRotation.y = toRadians(angle);
    scene.backgroundRotation.y = toRadians(angle);
  };

  const show = (entry: EnvironmentEntry): void => {
    shown = entry;
    scene.environment = entry.light;
    showBackdrop();
    invalidate();
  };

  const request = (id: string): void => {
    requestedId = id;
    const cached = cache.get(id);
    if (cached) {
      show(cached);
      return;
    }
    loader.load(id).then(
      (entry) => {
        if (disposed) return;
        cache.set(id, entry);
        if (requestedId === id) show(entry);
      },
      () => undefined, // a failed load keeps the light that is already shown
    );
  };

  const tick = (): void => {
    frame = undefined;
    if (!spinning || disposed) return;
    const time = now();
    rotateTo(angle + (AUTO_ROTATE_DEGREES_PER_SECOND * (time - lastTick)) / 1000);
    lastTick = time;
    invalidate();
    frame = clock.requestAnimationFrame(tick);
  };

  const startSpin = (startDegrees: number): void => {
    spinning = true;
    rotateTo(startDegrees);
    lastTick = now();
    frame = clock.requestAnimationFrame(tick);
  };

  const stopSpin = (): void => {
    spinning = false;
    if (frame !== undefined) clock.cancelAnimationFrame(frame);
    frame = undefined;
  };

  return {
    applySettings(settings) {
      if (disposed) return;
      backgroundVisible = settings.backgroundVisible;
      scene.environmentIntensity = settings.environmentIntensity;
      if (settings.hdri !== requestedId) request(settings.hdri);
      else showBackdrop();

      if (settings.autoRotate && !spinning) {
        startSpin(settings.environmentRotationDeg);
      } else if (!settings.autoRotate && spinning) {
        stopSpin();
        onRotationSettled(angle); // the light stays where it stopped
      } else if (!settings.autoRotate) {
        rotateTo(settings.environmentRotationDeg);
      }
      invalidate();
    },
    dispose() {
      disposed = true;
      stopSpin();
      scene.environment = null;
      scene.background = null;
      loader.dispose();
      cache.clear();
    },
  };
}
