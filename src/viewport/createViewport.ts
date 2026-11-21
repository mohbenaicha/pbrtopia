import type { Box3, Material, OrthographicCamera, PerspectiveCamera, Scene, WebGLRenderer } from 'three';
import { captureThumbnail, type ThumbnailSpec } from './captureThumbnail';
import { createCameraMotion, type CameraMotion } from './cameraMotion';
import { createMaterialFlash } from './materialFlash';
import type { MaskOverlayState } from './maskOverlay';
import type { OverrideChannel, OverridePicture } from './materialPictures';
import { createSurfacePicker } from './pickSurface';
import { createViewportHandle, type ViewportHandle } from './viewportHandle';
import type { CameraRig, Projection, ViewAxis } from './cameraRig';
import type { ModelAsset } from './loadModelAsset';
import { createEnvironment } from './environment';
import { createEnvironmentLoader } from './environmentLoader';
import { createModelHost, type GeometryReplacement } from './modelHost';
import { createOrbitControls } from './orbitControlsSetup';
import type { ShadingMode } from './shadingModes';
import type { ViewportResult } from './viewportError';
import type { ViewportEvents } from './viewportEvents';
import { createSnapshotLook, type SnapshotLook } from './snapshotLook';
import { createViewportCore, type ViewportCore } from './viewportCore';
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
  setMaterialPicture(materialIndex: number, channel: OverrideChannel, picture: OverridePicture | null): void; // lays a picture over one channel of one of the model's materials, null takes it off; the viewport owns the bitmap
  setMaskOverlay(state: MaskOverlayState | null): void; // mask-mode R20: translucent mask colours over the model in every shading look, display only; null takes them away
  setProjectionMaterial(material: Material | null): void; // replaces the model's look until cleared; the caller owns and disposes the material
  flashMaterial(material: Material): Promise<void>; // shows the material over the model three times, then the normal look; resolves when done
  captureThumbnail(spec?: ThumbnailSpec): Promise<Blob>; // the current view cropped to the thumbnail shape
  snapshotLook(): SnapshotLook; // generate R37: the scene as shown, for the atlas snapshots of the "Current viewport" render
  modelAsset(): ModelAsset | undefined; // the shown model with its meshes (mesh edit)
  replaceModelGeometry(replacements: readonly GeometryReplacement[]): boolean; // mesh edit Apply: the edited geometry goes into the shown model in place; false (nothing changed) when it cannot
  lockModelGeometry(locked: boolean): void; // auto smooth stops swapping the meshes' geometry while true (mesh edit); unlocking applies the current angle
  refreshModelGeometry(): void; // the meshes' geometry was swapped by the caller: overlays that share it are built again (mesh edit)
  setOverlayPass(pass: (() => void) | null): void; // drawn after every frame of the scene, on top of it (mesh edit's selection outline)
  setCameraControlsEnabled(enabled: boolean): void; // off while a gizmo or keyboard transform drag runs (mesh edit)
  setSettings(patch: Partial<ViewportSettings>): void;
  invalidate(): void;
  resetView(): void;
  frameBounds(box: Box3): void; // prep R38: the box fills the view and becomes the home view that resetView returns to; works with no model
  snapToAxis(axis: ViewAxis): void;
  setProjection(projection: Projection): void;
  on: ViewportEvents['on'];
  dispose(): void;
}

interface ViewportParts {
  core: ViewportCore;
  models: ReturnType<typeof createModelHost>;
  motion: CameraMotion;
  flash: ReturnType<typeof createMaterialFlash>;
  handle: ViewportHandle;
  orbit: ReturnType<typeof createOrbitControls>;
  environment: ReturnType<typeof createEnvironment>;
  applySettings(patch: Partial<ViewportSettings>): void;
  setProjection(projection: Projection): void;
}

// Puts a WebGL canvas in `container`, keeps it the container's size at the display's pixel ratio, and draws only on invalidate.
export function createViewport(container: HTMLElement, options: { settings?: ViewportSettings } = {}): Viewport {
  const core = createViewportCore(container);
  const { scene, rig, events, grid, scheduler, canvas } = core;
  const onCameraMoved = (): void => {
    rig.syncOrthographic();
    events.emit('camera-change');
    scheduler.invalidate();
  };
  const orbit = createOrbitControls(rig, canvas);
  orbit.controls.addEventListener('change', onCameraMoved);

  const models = createModelHost({
    scene,
    rig,
    invalidate: scheduler.invalidate,
    settings: options.settings ?? DEFAULT_VIEWPORT_SETTINGS,
    onBounds: grid.setBounds,
    onFramed: () => {
      orbit.applyDistanceLimits();
      orbit.controls.update();
      onCameraMoved();
    },
  });
  const setProjection = (projection: Projection): void => {
    if (!rig.setProjection(projection)) return;
    models.setSettings({ projection }); // the stored settings follow the camera, so a later setting change does not put the old projection back
    events.emit('projection-changed', projection);
    events.emit('settings-changed', models.settings());
    scheduler.invalidate();
  };
  const motion = createCameraMotion({ rig, orbit, setProjection, onCameraMoved });
  const handle = createViewportHandle({ canvas, camera: () => rig.active, pick: createSurfacePicker({ canvas, camera: () => rig.active, model: models.root }), events });
  const flash = createMaterialFlash({ show: models.setFlashMaterial });
  const environment = createEnvironment({
    scene,
    loader: createEnvironmentLoader(core.renderer),
    invalidate: scheduler.invalidate,
    onRotationSettled: (degrees) => {
      models.setSettings({ environmentRotationDeg: degrees });
      events.emit('settings-changed', models.settings());
    },
  });
  const applySettings = (patch: Partial<ViewportSettings>): void => {
    models.setSettings(patch);
    const settings = models.settings();
    grid.setVisible(settings.grid);
    setProjection(settings.projection);
    environment.applySettings(settings);
  };
  applySettings({});
  scheduler.invalidate();
  return assembleViewport({ core, models, motion, flash, handle, orbit, environment, applySettings, setProjection });
}

// The public object: each member forwards to the part that owns it.
function assembleViewport({ core, models, motion, flash, handle, orbit, environment, applySettings, setProjection }: ViewportParts): Viewport {
  const { rig, grid, scheduler } = core;
  return {
    renderer: core.renderer,
    scene: core.scene,
    get camera() {
      return rig.active;
    },
    cameraRig: rig,
    handle,
    loadModelAsset: models.load,
    unloadModel: models.unload,
    setShadingMode: models.setShadingMode,
    setProjectionMaterial: models.setProjectionMaterial,
    setMaterialPicture: models.setMaterialPicture,
    setMaskOverlay: models.setMaskOverlay,
    flashMaterial: flash.start,
    captureThumbnail(spec) {
      const picture = captureThumbnail(() => grid.drawWithoutGrid(core.drawFrame), core.canvas, spec);
      scheduler.invalidate(); // the canvas keeps the grid-less picture until it is drawn again
      return picture;
    },
    snapshotLook: () => createSnapshotLook(core.scene, grid.hide),
    modelAsset: models.asset,
    replaceModelGeometry: models.replaceGeometry,
    refreshModelGeometry: models.refreshGeometry,
    lockModelGeometry: models.lockGeometry,
    setOverlayPass: core.setOverlayPass,
    setCameraControlsEnabled(enabled) {
      orbit.controls.enabled = enabled;
    },
    setSettings: applySettings,
    invalidate: scheduler.invalidate,
    resetView: motion.resetView,
    frameBounds: motion.frameBounds,
    snapToAxis: motion.snapToAxis,
    setProjection,
    on: core.events.on,
    dispose() {
      motion.cancel();
      flash.dispose();
      handle.dispose();
      environment.dispose();
      models.dispose();
      orbit.dispose();
      core.dispose();
    },
  };
}
