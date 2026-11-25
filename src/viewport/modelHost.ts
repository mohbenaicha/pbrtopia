import { Box3, Sphere, type BufferGeometry, type Material, type Object3D, type Scene } from 'three';
import { removeHiddenTriangles } from '../hiddenMarks';
import type { CameraRig } from './cameraRig';
import { loadModelAsset, type ModelAsset } from './loadModelAsset';
import { createFlashOverlay, type FlashOverlay } from './flashOverlay';
import { createLitLook } from './litLook';
import { createMaskOverlay, type MaskOverlay, type MaskOverlayState } from './maskOverlay';
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

/** The geometry one mesh of the shown model takes over: every triangle, and the hidden flags per triangle (undefined = none hidden). */
export interface GeometryReplacement {
  ordinal: number;
  full: BufferGeometry;
  hidden: Uint8Array | undefined;
}

interface ModelHost {
  load(glb: ArrayBuffer): Promise<ViewportResult<ModelAsset>>;
  replaceGeometry(replacements: readonly GeometryReplacement[]): boolean; // swaps edited geometry into the shown model without loading it again, as loading the saved file would draw it; false (nothing changed) when no model is shown or a mesh is unknown
  unload(): void;
  setShadingMode(mode: ShadingMode): void;
  setProjectionMaterial(material: Material | null): void; // replaces the look while set; the shading mode is kept and comes back on clearing
  setFlashMaterial(material: Material | null): void; // laid over the current look as translucent copies of the meshes, for a moment; null takes it away
  replacePictureBitmap(pictureId: string, bitmap: ImageBitmap): boolean; // normal-reauthor R12: new pixels for a picture already shown; false (bitmap not taken) when it is not shown
  setMaterialPicture(materialIndex: number, channel: OverrideChannel, picture: OverridePicture | null): void; // lays a picture over one channel of one material (null takes it off); the viewport owns the bitmap
  setMaskOverlay(state: MaskOverlayState | null): void; // mask-mode R20: translucent mask colours over the model, in every shading look; null takes them away
  setSettings(patch: Partial<ViewportSettings>): void;
  settings(): ViewportSettings;
  root(): Object3D | undefined; // the shown model, for picking
  asset(): ModelAsset | undefined; // the shown model with its meshes (mesh edit)
  lockGeometry(locked: boolean): void; // while locked auto smooth leaves the meshes' geometry alone (the mesh edit mode owns it); unlocking applies the current angle
  refreshGeometry(): void; // the caller swapped the meshes' geometry: the wireframe overlay and the faceted flag follow it
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
  let current: { asset: ModelAsset; overlay: WireframeOverlay; flash: FlashOverlay; masks: MaskOverlay; pictures: MaterialPictures } | undefined;
  let maskState: MaskOverlayState | null = null; // kept across models: a reloaded model shows the same masks again
  let projectionMaterial: Material | null = null;
  let geometryLocked = false;

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
    current.masks.set(null); // its copies share the geometry that was swapped: built again
    current.masks.set(maskState);
    invalidate();
  };

  const unload = (): void => {
    if (!current) return;
    const { asset, overlay, flash, masks, pictures } = current;
    current = undefined;
    scene.remove(asset.root);
    flash.dispose();
    masks.dispose();
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
      const masks = createMaskOverlay(asset.root);
      current = { asset, overlay, flash: createFlashOverlay(asset.root), masks, pictures: createMaterialPictures(asset.sourceMaterials, showChangedPictures) };
      masks.set(maskState);
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
    replaceGeometry(replacements) {
      if (!current) return false;
      const { asset, flash, masks } = current;
      const records = replacements.map((replacement) => asset.meshes.find((candidate) => candidate.ordinal === replacement.ordinal));
      if (records.some((record) => record === undefined)) return false;
      flash.show(null); // its copies share the geometry that is about to go
      masks.set(null); // so do the mask overlay's; showRebuiltGeometry builds them again
      smoothing.cancel();
      smoothing.dispose(asset.root); // forgets the old geometry the creased copies were built from
      replacements.forEach((replacement, i) => {
        const record = records[i]!;
        const drawn = record.mesh.geometry;
        const old = record.full;
        record.full = replacement.full;
        record.hidden = replacement.hidden;
        record.mesh.geometry = replacement.hidden ? removeHiddenTriangles(replacement.full, replacement.hidden) : replacement.full;
        if (drawn !== old) drawn.dispose();
        old.dispose();
      });
      if (!geometryLocked) smoothing.apply(asset.root, settings.smoothAngleDeg);
      showRebuiltGeometry();
      const bounds = new Box3().setFromObject(asset.root);
      const sphere = bounds.getBoundingSphere(new Sphere());
      asset.bounds.center.copy(sphere.center);
      asset.bounds.radius = sphere.radius;
      onBounds?.(bounds);
      invalidate();
      return true;
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
    setMaskOverlay(state) {
      maskState = state;
      current?.masks.set(state);
      invalidate();
    },
    setMaterialPicture(materialIndex, channel, picture) {
      if (current) current.pictures.set(materialIndex, channel, picture);
      else picture?.bitmap.close(); // no model to show it on
    },
    replacePictureBitmap: (pictureId, bitmap) => current?.pictures.replaceBitmap(pictureId, bitmap) ?? false,
    root: () => current?.asset.root,
    asset: () => current?.asset,
    refreshGeometry: showRebuiltGeometry,
    lockGeometry(locked) {
      geometryLocked = locked;
      if (locked) smoothing.cancel(); // a request already waiting would swap the geometry under the mode
      if (!locked && current) smoothing.request(current.asset.root, settings.smoothAngleDeg, showRebuiltGeometry);
    },
    setSettings(patch) {
      const before = settings;
      settings = clampViewportSettings({ ...settings, ...patch, mapAdjust: { ...settings.mapAdjust, ...patch.mapAdjust } });
      setMapAdjust(adjust, settings.mapAdjust);
      current?.overlay.setVisible(settings.wireframe);
      if (current && settings.flatShading !== before.flatShading) modes.setFlatShading(current.asset.root, settings.flatShading);
      if (current && !geometryLocked && settings.smoothAngleDeg !== before.smoothAngleDeg) smoothing.request(current.asset.root, settings.smoothAngleDeg, showRebuiltGeometry);
      invalidate();
    },
    settings: () => settings,
    dispose: unload,
  };
}
