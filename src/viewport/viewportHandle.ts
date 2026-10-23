import { Vector3, type Camera } from 'three';
import { pixelsFromWorldRadius, worldRadiusFromPixels } from './pixelScale';
import type { SurfaceHit, SurfacePicker } from './pickSurface';
import type { FrameClock } from './renderScheduler';
import type { ViewportEvents } from './viewportEvents';

// What projection mode needs from the viewport (specs/projection/mode/contracts.md); it never touches the camera itself.
export interface ViewportHandle {
  pickSurfacePoint(clientX: number, clientY: number): SurfaceHit | null;
  worldRadiusAt(point: Vector3, sizePx: number): number; // a circle of sizePx screen pixels, as a radius in world units
  pixelsAt(point: Vector3, radiusWorld: number): number; // the inverse, for drawing the cursor
  onCameraChange(listener: (viewDirection: Vector3) => void): () => void; // at most once per frame; the direction the camera looks
  readonly canvasElement: HTMLCanvasElement;
  dispose(): void;
}

interface ViewportHandleOptions {
  canvas: HTMLCanvasElement;
  camera: () => Camera;
  pick: SurfacePicker;
  events: Pick<ViewportEvents, 'on'>;
  clock?: FrameClock;
}

export function createViewportHandle({ canvas, camera, pick, events, clock = window }: ViewportHandleOptions): ViewportHandle {
  const listeners = new Set<(viewDirection: Vector3) => void>();
  let frame: number | undefined;

  const deliver = (): void => {
    frame = undefined;
    const direction = camera().getWorldDirection(new Vector3());
    [...listeners].forEach((listener) => listener(direction.clone()));
  };

  const stopListening = events.on('camera-change', () => {
    if (frame === undefined && listeners.size > 0) frame = clock.requestAnimationFrame(deliver);
  });

  return {
    pickSurfacePoint: pick,
    worldRadiusAt: (point, sizePx) => worldRadiusFromPixels(camera(), point, sizePx, canvas.clientHeight),
    pixelsAt: (point, radiusWorld) => pixelsFromWorldRadius(camera(), point, radiusWorld, canvas.clientHeight),
    onCameraChange(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    canvasElement: canvas,
    dispose() {
      stopListening();
      if (frame !== undefined) clock.cancelAnimationFrame(frame);
      frame = undefined;
      listeners.clear();
    },
  };
}
