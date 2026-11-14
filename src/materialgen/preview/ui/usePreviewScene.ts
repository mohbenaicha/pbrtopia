import { useEffect, useRef, useState } from 'react';
import type { MapAdjust, Viewport } from '@shared/viewport';
import type { PreviewPrefs, PreviewValues } from '@mat/storage';
import type { MaskOverlaySettings } from '../material/createMaskOverlay';
import type { PreviewMaps } from '../material/previewMaps';
import type { ToolTransform } from '../material/toolTransform';
import type { PreviewShading } from '../math/flatViews';
import { attachTurntableControls } from '../scene/attachTurntableControls';
import { createPreviewScene, type PreviewScene } from '../scene/createPreviewScene';

interface PreviewSceneInputs {
  prefs: PreviewPrefs;
  values: PreviewValues;
  mapAdjust: MapAdjust;
  maps: PreviewMaps;
  shading: PreviewShading; // session-only (R51)
  maskOverlay: MaskOverlaySettings; // R18, R40
  maskHighlight?: number | null; // masks R80: the label under the pointer in the Material Masks controls
  toolTransform: ToolTransform | null; // an open Crop or Mirror (R58)
}

/**
 * Preview R1, R6, R20-R22: builds the preview scene in the viewport once it exists and removes it when the viewport goes (the group, its geometry, material and
 * textures are disposed). Turns the viewport's own orbit controls off, since a drag turns the mesh instead; refits the default distance when the canvas changes shape.
 * Every later change of an input reaches the scene without rebuilding it. Returns null until the viewport exists.
 */
export function usePreviewScene(viewport: Viewport | null, inputs: PreviewSceneInputs): PreviewScene | null {
  const latest = useRef(inputs);
  latest.current = inputs;
  const [scene, setScene] = useState<PreviewScene | null>(null);

  useEffect(() => {
    if (viewport === null) return undefined;
    viewport.setCameraControlsEnabled(false);
    const created = createPreviewScene({ scene: viewport.scene, rig: viewport.cameraRig, invalidate: viewport.invalidate }, latest.current.prefs, latest.current.values);
    created.setMapAdjust(latest.current.mapAdjust);
    created.bind(latest.current.maps);
    created.setShading(latest.current.shading);
    created.setMaskOverlay(latest.current.maskOverlay);
    created.setMaskHighlight(latest.current.maskHighlight ?? null);
    created.setToolTransform(latest.current.toolTransform);
    const detach = attachTurntableControls(viewport.renderer.domElement, created, created.orbitFilter);
    const stopResizing = viewport.on('resized', created.fitCamera);
    setScene(created);
    return () => {
      stopResizing();
      detach();
      created.dispose();
      setScene(null);
    };
  }, [viewport]);

  const { prefs, values, mapAdjust, maps, shading, maskOverlay, toolTransform } = inputs;
  const maskHighlight = inputs.maskHighlight ?? null;
  useEffect(() => scene?.setMaskOverlay(maskOverlay), [scene, maskOverlay]);
  useEffect(() => scene?.setMaskHighlight(maskHighlight), [scene, maskHighlight]);
  useEffect(() => scene?.setToolTransform(toolTransform), [scene, toolTransform]);
  useEffect(() => scene?.setShading(shading), [scene, shading]);
  useEffect(() => scene?.setMesh(prefs.mesh), [scene, prefs.mesh]);
  useEffect(() => scene?.setResolution(prefs.meshResolution), [scene, prefs.meshResolution]);
  useEffect(() => scene?.setAoIntensity(prefs.aoIntensity), [scene, prefs.aoIntensity]);
  useEffect(() => scene?.setNormalDirection(prefs.normalDirection), [scene, prefs.normalDirection]);
  useEffect(() => scene?.setValues(values), [scene, values]);
  useEffect(() => scene?.setMapAdjust(mapAdjust), [scene, mapAdjust]);
  useEffect(() => scene?.bind(maps), [scene, maps]);
  return scene;
}
