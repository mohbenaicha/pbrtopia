import { DoubleSide, FrontSide, Group, Matrix4, Mesh, Vector3, type BufferGeometry, type Material, type PerspectiveCamera, type Scene } from 'three';
import { createLitLook, createMapAdjustUniforms, setMapAdjust, type MapAdjust } from '@shared/viewport';
import type { NormalDirection, PreviewMesh, PreviewPrefs, PreviewValues } from '@mat/storage';
import { createFlatLooks } from '../material/createFlatLooks';
import { createMaskOverlay, type MaskOverlaySettings } from '../material/createMaskOverlay';
import { createPreviewMaterial } from '../material/createPreviewMaterial';
import { createToolShading } from '../material/createToolShading';
import type { ToolTransform } from '../material/toolTransform';
import { isFlatView, type PreviewShading } from '../math/flatViews';
import type { PreviewMaps } from '../material/previewMaps';
import { defaultDistance } from '../math/framing';
import { orbitPlane, PLANE_DEFAULT_POSE, planeCameraDirection } from '../math/planeOrbit';
import { DEFAULT_POSE, dollyBy, isDefaultView, turnPose, type TurntablePose } from '../math/turntable';
import { buildPreviewGeometry } from '../meshes/buildPreviewGeometry';
import { halfExtentsOf } from '../meshes/halfExtentsOf';
import type { TurntableFilter } from './attachTurntableControls';
import type { LocalRay, PaintSurface, PaintTextures } from './paintHost';

/** What the preview needs from the shared viewport (a `Viewport` provides all of it: `scene`, `cameraRig`, `invalidate`). */
export interface PreviewHost {
  scene: Scene;
  rig: { perspective: PerspectiveCamera; target: Vector3; placeCamera(direction: Vector3, distance: number): void };
  invalidate(): void;
}

export interface PreviewView extends TurntablePose {
  mesh: PreviewMesh;
  dolly: number;
}

export interface PreviewScene {
  setMesh(mesh: PreviewMesh): void; // R4: keeps material, settings and lighting; pose and dolly return to the default
  setResolution(level: number): void; // R39: builds the geometry once, at the chosen level
  bind(maps: PreviewMaps): void;
  setToolTransform(transform: ToolTransform | null): void; // R58: an open Crop or Mirror, applied to every map sample in the next frame; allocates nothing
  toolTransform(): ToolTransform | null; // what is shown now (null while the thumbnail is taken)
  setValues(values: PreviewValues): void;
  onValuesChange(listener: () => void): () => void; // compositing R56: told after every setValues (the painter's ghost follows the tiling); returns the unsubscribe
  setMaskOverlay(settings: MaskOverlaySettings): void; // R18, R40: the palette colours drawn into the albedo (display only)
  setMaskHighlight(label: number | null): void; // masks R80: one label's colour alone, with the switch on or off (display only)
  maskHighlight(): number | null; // the highlight shown now (null while the thumbnail is taken)
  setAoIntensity(intensity: number): void;
  setNormalDirection(direction: NormalDirection): void; // R60: DirectX turns the green of the normal map in the Shaded and the flat Normal views; nothing stored changes
  setShading(shading: PreviewShading): void; // R51: Shaded or one map unlit; the mesh, pose, dolly and displacement stay
  shading(): PreviewShading;
  setDragging(active: boolean): void; // the turntable reports a drag start and end (R53)
  captureThumbnail(capture: () => Promise<Blob>): Promise<Blob>; // R53: runs `capture` on the lit view at the default pose and dolly, then puts the user's view back
  setMapAdjust(patch: Partial<MapAdjust>): void; // normal, metal and roughness Strength and Contrast (R9, R13)
  turn(dx: number, dy: number, smallerSide: number): void;
  dolly(direction: number): void;
  resetView(): void;
  fitCamera(): void; // the viewport changed shape: the default distance follows, the user's dolly stays
  view(): PreviewView;
  // Compositing R4, R14, R25, R27: what a painting session needs of the preview.
  setPaintTextures(textures: PaintTextures | null): void; // the session's textures stand in for the stored ones in every look; null puts the stored ones back
  setOrbitFilter(filter: TurntableFilter | null): void; // events the painter takes itself, which the turntable leaves alone
  orbitFilter(): TurntableFilter | null;
  planeRay(ndcX: number, ndcY: number): LocalRay | null; // the ray under a canvas point in the Plane's own frame; null unless the mesh is the Plane
  paintSurface(): PaintSurface; // the displacement the Plane has now (preview R15) and the tiling
  overlayRoot(): Group; // a child of it is in the Plane's frame (x, y in [-0.5, 0.5], z up)
  dispose(): void;
}

const LOOK_DIRECTION = new Vector3(0, 0, 1);

/** Preview R57: the Material ball reads every map by position, one repeat per unit of length (at tiling 1); the Ball and the Plane read them by UV (0). */

/**
 * Preview R1-R7, R20-R23, R39: the one previewGroup in the viewport's scene with one mesh and one shared material. The camera looks at the origin down -z;
 * a drag turns the group (the camera and the light stay where they are), the wheel moves the camera along its line of sight.
 */
export function createPreviewScene(host: PreviewHost, prefs: PreviewPrefs, initialValues: PreviewValues): PreviewScene {
  const preview = createPreviewMaterial();
  preview.setValues(initialValues);
  preview.setAoIntensity(prefs.aoIntensity);
  const adjust = createMapAdjustUniforms();
  const litLook = createLitLook(adjust);
  const valueListeners = new Set<() => void>();
  const overlay = createMaskOverlay();
  overlay.setTile(initialValues.tilingX, initialValues.tilingY);
  overlay.patchLitMaterial(preview.material); // before the look's own patch, which wraps it
  const toolShading = createToolShading();
  toolShading.setTile(initialValues.tilingX, initialValues.tilingY);
  toolShading.setNormalFlipY(prefs.normalDirection === 'directx');
  const flatLooks = createFlatLooks(adjust, overlay.uniforms, toolShading.uniforms);
  let toolTransform: ToolTransform | null = null;
  let maskSettings: MaskOverlaySettings = { on: false, opacity: prefs.maskOverlayOpacity, palette: null };
  overlay.setSettings(maskSettings);
  let highlight: number | null = null; // masks R80
  let highlightHidden = false; // while the thumbnail is taken

  let shading: PreviewShading = 'lit';
  let meshKind = prefs.mesh;
  let resolution = prefs.meshResolution;
  const homePoseOf = (kind: PreviewMesh): TurntablePose => (kind === 'plane' ? PLANE_DEFAULT_POSE : DEFAULT_POSE);
  let pose: TurntablePose = homePoseOf(meshKind);
  let dolly = 1;
  let facing = false; // R62, R53: the thumbnail shows the Plane square-on, not from its orbit view
  const orbits = (): boolean => meshKind === 'plane' && !facing; // R62: the Plane lies flat and the camera moves
  let dragging = false;
  let orbitFilter: TurntableFilter | null = null;
  let disposed = false;
  let dragEndWaiters: Array<() => void> = [];

  const mesh = new Mesh<BufferGeometry, Material>(buildPreviewGeometry(meshKind, resolution), preview.material);
  const group = new Group();
  group.name = 'previewGroup';
  group.add(mesh);
  host.scene.add(group);
  litLook.attach(group);
  toolShading.patchLitMaterial(preview.material); // after the look's patch, so it sees the shader the look has changed and wraps it

  const placeCamera = (): void => {
    const extents = halfExtentsOf(mesh.geometry);
    const camera = host.rig.perspective;
    host.rig.target.set(0, 0, 0);
    const direction = orbits() ? planeCameraDirection(pose) : LOOK_DIRECTION;
    host.rig.placeCamera(new Vector3(direction.x, direction.y, direction.z), defaultDistance(extents, camera.fov, camera.aspect) * dolly);
  };
  // R2: only the Plane needs its back face; the Ball and the Material ball are closed surfaces. A change of side needs the shader built again.
  const applySide = (): void => {
    const side = meshKind === 'plane' ? DoubleSide : FrontSide;
    for (const material of [preview.material, mesh.material]) {
      if (material.side === side) continue;
      material.side = side;
      material.needsUpdate = true;
    }
  };
  const applyShading = (): void => {
    flatLooks.sync(preview);
    mesh.material = isFlatView(shading) ? flatLooks.materialFor(shading) : preview.material;
    applySide();
  };
  const applyPose = (): void => void (orbits() ? group.rotation.set(-Math.PI / 2, 0, 0) : group.rotation.set(pose.pitch, pose.yaw, 0));
  const swapGeometry = (): void => {
    const old = mesh.geometry;
    mesh.geometry = buildPreviewGeometry(meshKind, resolution);
    old.dispose();
  };
  applyPose(); // a scene that starts on the Plane has it lying flat from the first frame (R62)
  placeCamera();
  applySide();

  return {
    setMesh(next) {
      if (next !== meshKind) {
        meshKind = next;
        swapGeometry();
        applySide();
      }
      pose = homePoseOf(meshKind);
      dolly = 1;
      applyPose();
      placeCamera();
      host.invalidate();
    },
    setResolution(level) {
      if (level === resolution) return;
      resolution = level;
      swapGeometry();
      host.invalidate();
    },
    bind(maps) {
      preview.bind(maps);
      overlay.setLabels(maps.labels);
      applyShading();
      host.invalidate();
    },
    setToolTransform(transform) {
      toolTransform = transform;
      toolShading.set(transform);
      host.invalidate();
    },
    toolTransform: () => toolTransform,
    setValues(values) {
      preview.setValues(values);
      overlay.setTile(values.tilingX, values.tilingY);
      toolShading.setTile(values.tilingX, values.tilingY);
      applyShading();
      host.invalidate();
      for (const listener of [...valueListeners]) listener();
    },
    onValuesChange(listener) {
      valueListeners.add(listener);
      return () => void valueListeners.delete(listener);
    },
    setMaskHighlight(label) {
      if (label === highlight) return;
      highlight = label;
      overlay.setHighlight(label);
      host.invalidate();
    },
    maskHighlight: () => (highlightHidden ? null : highlight),
    setMaskOverlay(settings) {
      maskSettings = settings;
      overlay.setSettings(settings);
      host.invalidate();
    },
    setShading(next) {
      if (next === shading) return;
      shading = next;
      applyShading();
      host.invalidate();
    },
    shading: () => shading,
    setDragging(active) {
      dragging = active;
      if (active) return;
      const waiting = dragEndWaiters;
      dragEndWaiters = [];
      for (const resume of waiting) resume();
    },
    async captureThumbnail(capture) {
      if (dragging) await new Promise<void>((resume) => dragEndWaiters.push(resume)); // never the dragged pose
      if (disposed) throw new Error('The preview was closed before the thumbnail was taken.');
      const kept = { pose, dolly, shading };
      pose = DEFAULT_POSE;
      facing = true;
      dolly = 1;
      shading = 'lit';
      overlay.setSettings({ ...maskSettings, on: false }); // the thumbnail is the material, not the masks
      highlightHidden = true;
      overlay.setHighlight(null);
      const keptTool = toolTransform;
      toolTransform = null; // nor an open Crop or Mirror (R58)
      toolShading.set(null);
      applyPose();
      placeCamera();
      applyShading();
      try {
        return capture(); // the canvas is copied before this returns, so the user's view can come back at once
      } finally {
        ({ pose, dolly, shading } = kept);
        facing = false;
        overlay.setSettings(maskSettings);
        highlightHidden = false;
        overlay.setHighlight(highlight);
        toolTransform = keptTool;
        toolShading.set(keptTool);
        applyPose();
        placeCamera();
        applyShading();
        host.invalidate();
      }
    },
    setAoIntensity(intensity) {
      preview.setAoIntensity(intensity);
      host.invalidate();
    },
    setNormalDirection(direction) {
      toolShading.setNormalFlipY(direction === 'directx');
      host.invalidate();
    },
    setMapAdjust(patch) {
      setMapAdjust(adjust, patch);
      host.invalidate();
    },
    turn(dx, dy, smallerSide) {
      const next = orbits() ? orbitPlane(pose, dx, dy, smallerSide) : turnPose(pose, dx, dy, smallerSide);
      if (next === pose) return;
      pose = next;
      applyPose();
      if (orbits()) placeCamera(); // R62: the camera moves, the Plane does not
      host.invalidate();
    },
    dolly(direction) {
      const next = dollyBy(dolly, direction);
      if (next === dolly) return;
      dolly = next;
      placeCamera();
      host.invalidate();
    },
    resetView() {
      if (isDefaultView(pose, dolly, homePoseOf(meshKind))) return;
      pose = homePoseOf(meshKind);
      dolly = 1;
      applyPose();
      placeCamera();
      host.invalidate();
    },
    fitCamera() {
      placeCamera();
      host.invalidate();
    },
    view: () => ({ mesh: meshKind, yaw: pose.yaw, pitch: pose.pitch, dolly }),
    setPaintTextures(textures) {
      preview.setOverrides(textures);
      applyShading();
      host.invalidate();
    },
    setOrbitFilter(filter) {
      orbitFilter = filter;
    },
    orbitFilter: () => orbitFilter,
    planeRay(ndcX, ndcY) {
      if (meshKind !== 'plane') return null;
      const camera = host.rig.perspective;
      camera.updateMatrixWorld();
      group.updateMatrixWorld(true);
      const origin = new Vector3().setFromMatrixPosition(camera.matrixWorld);
      const direction = new Vector3(ndcX, ndcY, 0.5).unproject(camera).sub(origin);
      const inverse = new Matrix4().copy(group.matrixWorld).invert();
      origin.applyMatrix4(inverse);
      direction.transformDirection(inverse);
      return { origin: [origin.x, origin.y, origin.z], direction: [direction.x, direction.y, direction.z] };
    },
    paintSurface: () => ({ scale: preview.material.displacementScale, bias: preview.material.displacementBias, tilingX: preview.values.tilingX, tilingY: preview.values.tilingY }),
    overlayRoot: () => group,
    dispose() {
      disposed = true;
      litLook.detach(group);
      host.scene.remove(group);
      mesh.geometry.dispose();
      flatLooks.dispose();
      overlay.dispose();
      preview.dispose();
      host.invalidate();
    },
  };
}
