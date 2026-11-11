import { NeutralToneMapping, Scene, WebGLRenderer } from 'three';
import { createCameraRig, type CameraRig } from './cameraRig';
import { watchContextLoss } from './contextLoss';
import { watchPixelRatio } from './pixelRatio';
import { createFrameRenderer } from './renderFrame';
import { createRenderScheduler } from './renderScheduler';
import { createViewportEvents, type ViewportEvents } from './viewportEvents';
import { createViewportGrid, type ViewportGrid } from './viewportGrid';

/** What a viewport needs before any model, camera control or setting exists: the canvas, its size, the scene, the camera rig and the draw loop. */
export interface ViewportCore {
  renderer: WebGLRenderer;
  canvas: HTMLCanvasElement;
  scene: Scene;
  rig: CameraRig;
  events: ViewportEvents;
  grid: ViewportGrid;
  scheduler: ReturnType<typeof createRenderScheduler>;
  drawFrame(): void; // the scene, the grid and the overlay pass, drawn now
  setOverlayPass(pass: (() => void) | null): void; // drawn after every frame of the scene, on top of it
  dispose(): void;
}

// Keeps the canvas the container's size at the display's pixel ratio. A hidden container reports 0x0: the last good size is kept until it is shown again.
function watchViewportSize(renderer: WebGLRenderer, container: HTMLElement, rig: CameraRig, redraw: () => void): () => void {
  const canvas = renderer.domElement;
  let width = 0;
  let height = 0;
  const resizeTo = (nextWidth: number, nextHeight: number): void => {
    if (nextWidth === 0 || nextHeight === 0) return;
    width = nextWidth;
    height = nextHeight;
    renderer.setSize(width, height, false);
    canvas.style.width = '100%';
    canvas.style.height = '100%';
    rig.setAspect(width / height);
    redraw(); // setSize cleared the canvas: drawn again before the browser paints, never one frame later
  };
  const observer = new ResizeObserver(() => resizeTo(container.clientWidth, container.clientHeight));
  observer.observe(container);
  resizeTo(container.clientWidth, container.clientHeight);
  const stopWatchingPixelRatio = watchPixelRatio((ratio) => {
    renderer.setPixelRatio(ratio);
    resizeTo(width, height);
  });
  return () => {
    observer.disconnect();
    stopWatchingPixelRatio();
  };
}

// Puts a WebGL canvas in `container` and draws only on invalidate.
export function createViewportCore(container: HTMLElement): ViewportCore {
  const renderer = new WebGLRenderer({ antialias: true });
  renderer.toneMapping = NeutralToneMapping; // keeps albedo colours true under the HDRI light
  const scene = new Scene();
  scene.backgroundBlurriness = 0.12;
  const rig = createCameraRig(1);
  rig.resetView();
  const events = createViewportEvents();
  const grid = createViewportGrid({ scene, rig });
  const drawScene = createFrameRenderer(renderer, scene, rig);
  let overlayPass: (() => void) | null = null;
  const drawFrame = (): void => {
    grid.update();
    drawScene();
    overlayPass?.();
  };
  const scheduler = createRenderScheduler(drawFrame);

  const canvas = renderer.domElement;
  canvas.style.display = 'block';
  container.appendChild(canvas);
  renderer.setPixelRatio(window.devicePixelRatio);
  const stopWatchingSize = watchViewportSize(renderer, container, rig, () => {
    events.emit('resized');
    scheduler.drawNow();
  });
  const stopWatchingContext = watchContextLoss(canvas, {
    onLost: () => {
      scheduler.pause();
      events.emit('context-lost');
    },
    onRestored: () => {
      scheduler.resume();
      events.emit('context-restored');
    },
  });

  return {
    renderer,
    canvas,
    scene,
    rig,
    events,
    grid,
    scheduler,
    drawFrame,
    setOverlayPass(pass) {
      overlayPass = pass;
      scheduler.invalidate();
    },
    dispose() {
      grid.dispose();
      stopWatchingSize();
      stopWatchingContext();
      scheduler.dispose();
      events.clear();
      renderer.dispose();
      renderer.forceContextLoss();
      canvas.remove();
    },
  };
}
