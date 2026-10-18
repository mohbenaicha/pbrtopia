import { PerspectiveCamera, Scene, WebGLRenderer } from 'three';
import { watchContextLoss } from './contextLoss';
import { watchPixelRatio } from './pixelRatio';
import { createRenderScheduler } from './renderScheduler';
import { createViewportEvents, type ViewportEvents } from './viewportEvents';

// The part of the contract in specs/app/viewport-layout/contracts.md that exists so far; later tasks add the camera rig, model, looks and slots.
export interface Viewport {
  renderer: WebGLRenderer;
  scene: Scene;
  camera: PerspectiveCamera;
  invalidate(): void;
  on: ViewportEvents['on'];
  dispose(): void;
}

// Puts a WebGL canvas in `container`, keeps it the container's size at the display's pixel ratio, and draws only on invalidate.
export function createViewport(container: HTMLElement): Viewport {
  const renderer = new WebGLRenderer({ antialias: true });
  const scene = new Scene();
  const camera = new PerspectiveCamera(40, 1, 0.05, 1000);
  camera.position.set(0, 0, 3);
  const events = createViewportEvents();
  const scheduler = createRenderScheduler(() => renderer.render(scene, camera));

  const canvas = renderer.domElement;
  canvas.style.display = 'block';
  container.appendChild(canvas);
  renderer.setPixelRatio(window.devicePixelRatio);

  let width = 0;
  let height = 0;
  const resizeTo = (nextWidth: number, nextHeight: number): void => {
    // A hidden container reports 0x0: keep the last good size until it is shown again.
    if (nextWidth === 0 || nextHeight === 0) return;
    width = nextWidth;
    height = nextHeight;
    renderer.setSize(width, height, false);
    canvas.style.width = '100%';
    canvas.style.height = '100%';
    camera.aspect = width / height;
    camera.updateProjectionMatrix();
    scheduler.invalidate();
  };

  const observer = new ResizeObserver(() => resizeTo(container.clientWidth, container.clientHeight));
  observer.observe(container);
  resizeTo(container.clientWidth, container.clientHeight);

  const stopWatchingPixelRatio = watchPixelRatio((ratio) => {
    renderer.setPixelRatio(ratio);
    resizeTo(width, height);
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

  scheduler.invalidate();

  return {
    renderer,
    scene,
    camera,
    invalidate: scheduler.invalidate,
    on: events.on,
    dispose() {
      observer.disconnect();
      stopWatchingPixelRatio();
      stopWatchingContext();
      scheduler.dispose();
      events.clear();
      renderer.dispose();
      renderer.forceContextLoss();
      canvas.remove();
    },
  };
}
