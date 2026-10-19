import { NeutralToneMapping, Quaternion, Scene, WebGLRenderer, type Material, type OrthographicCamera, type PerspectiveCamera } from 'three';
import { captureThumbnail, type ThumbnailSpec } from './captureThumbnail';
import { createMaterialFlash } from './materialFlash';
import { createSurfacePicker } from './pickSurface';
import { createViewportHandle, type ViewportHandle } from './viewportHandle';
import { createCameraRig, viewDirectionForAxis, type CameraRig, type Projection, type ViewAxis } from './cameraRig';
import { runCameraTransition } from './cameraTransition';
import { watchContextLoss } from './contextLoss';
import type { ModelAsset } from './loadModelAsset';
import { createEnvironment } from './environment';
import { createEnvironmentLoader } from './environmentLoader';
import { createModelHost } from './modelHost';
import { createOrbitControls } from './orbitControlsSetup';
import { watchPixelRatio } from './pixelRatio';
import { createRenderScheduler } from './renderScheduler';
import type { ShadingMode } from './shadingModes';
import type { ViewportResult } from './viewportError';
import { createViewportEvents, type ViewportEvents } from './viewportEvents';
import { DEFAULT_VIEWPORT_SETTINGS, type ViewportSettings } from './viewportSettings';

// The part of the contract in specs/app/viewport-layout/contracts.md that exists so far; later tasks add the environment, picking and slots.
export interface Viewport {
  renderer: WebGLRenderer;
  scene: Scene;
  readonly camera: PerspectiveCamera | OrthographicCamera; // whichever projection is active
  cameraRig: CameraRig; // target, radius and both cameras; read-only for features
  readonly handle: ViewportHandle; // what projection mode uses: picking, pixel and world sizes, camera changes
  loadModelAsset(glb: ArrayBuffer): Promise<ViewportResult<ModelAsset>>; // replaces the shown model; on failure the old one stays
  unloadModel(): void;
  setShadingMode(mode: ShadingMode): void; // remembered while a projection material is set
  setProjectionMaterial(material: Material | null): void; // replaces the model's look until cleared; the caller owns and disposes the material
  flashMaterial(material: Material): Promise<void>; // shows the material over the model three times, then the normal look; resolves when done
  captureThumbnail(spec?: ThumbnailSpec): Promise<Blob>; // the current view cropped to the thumbnail shape
  setSettings(patch: Partial<ViewportSettings>): void;
  invalidate(): void;
  resetView(): void;
  snapToAxis(axis: ViewAxis): void;
  setProjection(projection: Projection): void;
  on: ViewportEvents['on'];
  dispose(): void;
}

// Puts a WebGL canvas in `container`, keeps it the container's size at the display's pixel ratio, and draws only on invalidate.
export function createViewport(container: HTMLElement, options: { settings?: ViewportSettings } = {}): Viewport {
  const renderer = new WebGLRenderer({ antialias: true });
  renderer.toneMapping = NeutralToneMapping; // keeps albedo colours true under the HDRI light
  const scene = new Scene();
  const rig = createCameraRig(1);
  rig.resetView();
  const events = createViewportEvents();
  const scheduler = createRenderScheduler(() => renderer.render(scene, rig.active));

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
    rig.setAspect(width / height);
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

  const onCameraMoved = (): void => {
    rig.syncOrthographic();
    events.emit('camera-change');
    scheduler.invalidate();
  };
  let cancelTransition = (): void => undefined;
  const orbit = createOrbitControls(rig, canvas, () => viewport.resetView());
  orbit.controls.addEventListener('change', onCameraMoved);
  orbit.controls.addEventListener('start', () => cancelTransition());

  const setProjection = (projection: Projection): void => {
    if (!rig.setProjection(projection)) return;
    models.setSettings({ projection }); // the stored settings follow the camera, so a later setting change does not put the old projection back
    events.emit('projection-changed', projection);
    events.emit('settings-changed', models.settings());
    scheduler.invalidate();
  };

  const models = createModelHost({
    scene,
    rig,
    invalidate: scheduler.invalidate,
    settings: options.settings ?? DEFAULT_VIEWPORT_SETTINGS,
    onFramed: () => {
      orbit.applyDistanceLimits();
      orbit.controls.update();
      onCameraMoved();
    },
  });

  const handle = createViewportHandle({
    canvas,
    camera: () => rig.active,
    pick: createSurfacePicker({ canvas, camera: () => rig.active, model: models.root }),
    events,
  });
  const flash = createMaterialFlash({ show: models.setFlashMaterial });

  const environment = createEnvironment({
    scene,
    loader: createEnvironmentLoader(renderer),
    invalidate: scheduler.invalidate,
    onRotationSettled: (degrees) => {
      models.setSettings({ environmentRotationDeg: degrees });
      events.emit('settings-changed', models.settings());
    },
  });
  const applySettings = (patch: Partial<ViewportSettings>): void => {
    models.setSettings(patch);
    const settings = models.settings();
    setProjection(settings.projection);
    environment.applySettings(settings);
  };
  applySettings({});

  scheduler.invalidate();

  const viewport: Viewport = {
    renderer,
    scene,
    get camera() {
      return rig.active;
    },
    cameraRig: rig,
    handle,
    loadModelAsset: models.load,
    unloadModel: models.unload,
    setShadingMode: models.setShadingMode,
    setProjectionMaterial: models.setProjectionMaterial,
    flashMaterial: flash.start,
    captureThumbnail: (spec) => captureThumbnail(() => renderer.render(scene, rig.active), canvas, spec),
    setSettings: applySettings,
    invalidate: scheduler.invalidate,
    resetView() {
      cancelTransition();
      rig.resetView();
      orbit.controls.update();
      onCameraMoved();
    },
    snapToAxis(axis) {
      cancelTransition();
      setProjection('orthographic');
      const fromDirection = rig.perspective.position.clone().sub(rig.target).normalize();
      const fromTarget = rig.target.clone();
      const fromDistance = rig.distance();
      const toDirection = viewDirectionForAxis(axis);
      const toTarget = rig.homeCenter();
      const toDistance = rig.homeDistance();
      const turn = new Quaternion().setFromUnitVectors(fromDirection, toDirection);
      cancelTransition = runCameraTransition((progress) => {
        rig.target.lerpVectors(fromTarget, toTarget, progress);
        const direction = progress === 1 ? toDirection : fromDirection.clone().applyQuaternion(new Quaternion().slerp(turn, progress));
        rig.placeCamera(direction, fromDistance + (toDistance - fromDistance) * progress);
        orbit.controls.update();
        onCameraMoved();
      });
    },
    setProjection,
    on: events.on,
    dispose() {
      cancelTransition();
      flash.dispose();
      handle.dispose();
      environment.dispose();
      models.dispose();
      orbit.dispose();
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
  return viewport;
}
