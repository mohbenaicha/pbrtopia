import { Box3, type Scene } from 'three';
import type { CameraRig } from './cameraRig';
import { loadModelAsset, type ModelAsset } from './loadModelAsset';
import { createMapAdjustUniforms, setMapAdjust } from './mapAdjustUniforms';
import { createShadingModes, type ShadingMode } from './shadingModes';
import type { ViewportResult } from './viewportError';
import { clampViewportSettings, type ViewportSettings } from './viewportSettings';
import { createWireframeOverlay, type WireframeOverlay } from './wireframeOverlay';

export interface ModelHostOptions {
  scene: Scene;
  rig: CameraRig;
  invalidate(): void;
  onFramed(): void; // the camera was moved to frame a new model
  settings: ViewportSettings;
}

export interface ModelHost {
  load(glb: ArrayBuffer): Promise<ViewportResult<ModelAsset>>;
  unload(): void;
  setShadingMode(mode: ShadingMode): void;
  setSettings(patch: Partial<ViewportSettings>): void;
  settings(): ViewportSettings;
  dispose(): void;
}

// Owns the model in the scene: loading and replacing it, its shading look, wireframe overlay and metal/rough adjustment.
export function createModelHost({ scene, rig, invalidate, onFramed, settings: initial }: ModelHostOptions): ModelHost {
  let settings = clampViewportSettings(initial);
  let mode: ShadingMode = 'lit';
  const adjust = createMapAdjustUniforms(settings.mapAdjust);
  const modes = createShadingModes(adjust);
  let current: { asset: ModelAsset; overlay: WireframeOverlay } | undefined;

  const unload = (): void => {
    if (!current) return;
    const { asset, overlay } = current;
    current = undefined;
    scene.remove(asset.root);
    overlay.dispose();
    modes.dispose(asset.root);
    asset.dispose();
    invalidate();
  };

  return {
    async load(glb) {
      const result = await loadModelAsset(glb);
      if (!result.ok) return result;
      unload();
      const asset = result.value;
      const overlay = createWireframeOverlay(asset.root);
      current = { asset, overlay };
      scene.add(asset.root);
      overlay.setVisible(settings.wireframe);
      modes.apply(asset.root, mode);
      rig.frameBounds(new Box3().setFromObject(asset.root));
      onFramed();
      invalidate();
      return result;
    },
    unload,
    setShadingMode(next) {
      mode = next;
      if (current) modes.apply(current.asset.root, mode);
      invalidate();
    },
    setSettings(patch) {
      settings = clampViewportSettings({ ...settings, ...patch, mapAdjust: { ...settings.mapAdjust, ...patch.mapAdjust } });
      setMapAdjust(adjust, settings.mapAdjust);
      current?.overlay.setVisible(settings.wireframe);
      invalidate();
    },
    settings: () => settings,
    dispose: unload,
  };
}
