import { Box3, type Material, type Object3D, type Scene } from 'three';
import type { CameraRig } from './cameraRig';
import { loadModelAsset, type ModelAsset } from './loadModelAsset';
import { createFlashOverlay, type FlashOverlay } from './flashOverlay';
import { createLitLook } from './litLook';
import { createMaterialPictures, type MaterialPictures, type OverrideChannel, type OverridePicture } from './materialPictures';
import { createMapAdjustUniforms, setMapAdjust } from './mapAdjustUniforms';
import { createModelSmoothing } from './modelSmoothing';
import { createShadingModes, type ShadingMode } from './shadingModes';
import type { ViewportResult } from './viewportError';
import { clampViewportSettings, type ViewportSettings } from './viewportSettings';
import { createWireframeOverlay, type WireframeOverlay } from './wireframeOverlay';

interface ModelHostOptions {
  scene: Scene;
  rig: CameraRig;
  invalidate(): void;
  onFramed(): void; // the camera was moved to frame a new model
  onBounds?(box: Box3 | null): void; // the box of the shown model, or null when there is none (the ground grid follows it)
  settings: ViewportSettings;
}

interface ModelHost {
  load(glb: ArrayBuffer): Promise<ViewportResult<ModelAsset>>;
  unload(): void;
  setShadingMode(mode: ShadingMode): void;
  setProjectionMaterial(material: Material | null): void; // replaces the look while set; the shading mode is kept and comes back on clearing
  setFlashMaterial(material: Material | null): void; // laid over the current look as translucent copies of the meshes, for a moment; null takes it away
  setMaterialPicture(materialIndex: number, channel: OverrideChannel, picture: OverridePicture | null): void; // lays a picture over one channel of one material (null takes it off); the viewport owns the bitmap
  setSettings(patch: Partial<ViewportSettings>): void;
  settings(): ViewportSettings;
  root(): Object3D | undefined; // the shown model, for picking
  dispose(): void;
}

// Owns the model in the scene: loading and replacing it, its shading look, wireframe overlay and metal/rough adjustment.
export function createModelHost({ scene, rig, invalidate, onFramed, onBounds, settings: initial }: ModelHostOptions): ModelHost {
  let settings = clampViewportSettings(initial);
  let mode: ShadingMode = 'lit';
  const adjust = createMapAdjustUniforms(settings.mapAdjust);
  const modes = createShadingModes(adjust);
  const litLook = createLitLook(adjust);
  const smoothing = createModelSmoothing();
  let current: { asset: ModelAsset; overlay: WireframeOverlay; flash: FlashOverlay; pictures: MaterialPictures } | undefined;
  let projectionMaterial: Material | null = null;

  // What the model shows: the projection material, else the chosen shading mode. A flash is laid over either, not swapped in.
  const showLook = (): void => {
    if (!current) return;
    if (projectionMaterial) modes.applyMaterial(current.asset.root, projectionMaterial);
    else modes.apply(current.asset.root, mode);
    invalidate();
  };

  // A picture was laid over (or taken off) a source material: the flat looks copied its maps at build, so they are built again.
  const showChangedPictures = (): void => {
    if (!current) return;
    modes.refresh(current.asset.root);
    showLook();
  };

  // The geometry was swapped by auto smooth: the faceted flag depends on the normals, and the wireframe overlay shares the geometry.
  const showRebuiltGeometry = (): void => {
    if (!current) return;
    modes.setFlatShading(current.asset.root, settings.flatShading);
    current.overlay.setVisible(false);
    current.overlay.setVisible(settings.wireframe);
    invalidate();
  };

  const unload = (): void => {
    if (!current) return;
    const { asset, overlay, flash, pictures } = current;
    current = undefined;
    scene.remove(asset.root);
    flash.dispose();
    overlay.dispose();
    smoothing.dispose(asset.root);
    litLook.detach(asset.root);
    modes.dispose(asset.root);
    pictures.release(); // the file's own maps go back before the asset frees what is on its materials
    asset.dispose();
    onBounds?.(null);
    invalidate();
  };

  return {
    async load(glb) {
      const result = await loadModelAsset(glb);
      if (!result.ok) return result;
      unload();
      const asset = result.value;
      smoothing.apply(asset.root, settings.smoothAngleDeg);
      const overlay = createWireframeOverlay(asset.root);
      litLook.attach(asset.root);
      current = { asset, overlay, flash: createFlashOverlay(asset.root), pictures: createMaterialPictures(asset.sourceMaterials, showChangedPictures) };
      scene.add(asset.root);
      overlay.setVisible(settings.wireframe);
      showLook();
      modes.setFlatShading(asset.root, settings.flatShading);
      const bounds = new Box3().setFromObject(asset.root);
      onBounds?.(bounds);
      rig.frameBounds(bounds);
      onFramed();
      invalidate();
      return result;
    },
    unload,
    setShadingMode(next) {
      mode = next;
      showLook();
      invalidate();
    },
    setProjectionMaterial(material) {
      projectionMaterial = material;
      showLook();
      invalidate();
    },
    setFlashMaterial(material) {
      current?.flash.show(material);
      invalidate();
    },
    setMaterialPicture(materialIndex, channel, picture) {
      if (current) current.pictures.set(materialIndex, channel, picture);
      else picture?.bitmap.close(); // no model to show it on
    },
    root: () => current?.asset.root,
    setSettings(patch) {
      const before = settings;
      settings = clampViewportSettings({ ...settings, ...patch, mapAdjust: { ...settings.mapAdjust, ...patch.mapAdjust } });
      setMapAdjust(adjust, settings.mapAdjust);
      current?.overlay.setVisible(settings.wireframe);
      if (current && settings.flatShading !== before.flatShading) modes.setFlatShading(current.asset.root, settings.flatShading);
      if (current && settings.smoothAngleDeg !== before.smoothAngleDeg) smoothing.request(current.asset.root, settings.smoothAngleDeg, showRebuiltGeometry);
      invalidate();
    },
    settings: () => settings,
    dispose: unload,
  };
}
