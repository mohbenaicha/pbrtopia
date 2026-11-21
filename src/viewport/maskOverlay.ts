import { Color, DataTexture, NearestFilter, RedFormat, ShaderMaterial, UnsignedByteType, Vector3, type Mesh, type Object3D } from 'three';
import { createOverlayMesh } from './overlayMesh';

export interface MaskOverlayState {
  labels: Uint8Array; // size x size, one byte per texel; row 0 is v = 0 (the order a glTF texture uses)
  size: number;
  palette: ReadonlyArray<{ hex: string }>; // entry k is label k
  on: boolean;
  opacity: number; // 0 to 1
  highlight: number | null; // one label drawn alone at HIGHLIGHT_OPACITY
}

export interface MaskOverlay {
  /** Shows, updates or (null) removes the overlay; display only. The same labels array keeps its texture. */
  set(state: MaskOverlayState | null): void;
  dispose(): void;
}

export const MAX_PALETTE_ENTRIES = 10;
export const MASK_OVERLAY_RENDER_ORDER = 2; // above the layer flash's 1, so the two never fight for the same pixels
export const HIGHLIGHT_OPACITY = 0.75;

const VERTEX = /* glsl */ `
varying vec2 vUv;
void main() {
  vUv = uv;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}`;

// Label by nearest sampling; the palette by label. One label drawn alone when highlighted (uHighlight >= 0), the others not at all.
const FRAGMENT = /* glsl */ `
uniform sampler2D uLabels;
uniform vec3 uPalette[${MAX_PALETTE_ENTRIES}];
uniform int uPaletteSize;
uniform float uOpacity;
uniform float uHighlight;
varying vec2 vUv;
void main() {
  int label = int(floor(texture2D(uLabels, vUv).r * 255.0 + 0.5));
  if (label >= uPaletteSize) discard;
  float alpha = uOpacity;
  if (uHighlight >= 0.0) {
    if (label != int(uHighlight + 0.5)) discard;
    alpha = ${HIGHLIGHT_OPACITY.toFixed(2)};
  }
  vec3 colour = uPalette[0];
  for (int k = 1; k < ${MAX_PALETTE_ENTRIES}; k++) { if (k == label) colour = uPalette[k]; }
  gl_FragColor = vec4(colour, alpha);
}`;

const isModelMesh = (object: Object3D): object is Mesh => (object as Mesh).isMesh === true && object.userData['isWireframeOverlay'] !== true;

const paletteVectors = (palette: MaskOverlayState['palette']): Vector3[] =>
  Array.from({ length: MAX_PALETTE_ENTRIES }, (_, index) => {
    const entry = palette[index];
    const colour = new Color(entry === undefined ? '#000000' : entry.hex);
    return new Vector3(colour.r, colour.g, colour.b); // the palette's hex as written, no colour-space change: the overlay is a flat key colour
  });

/**
 * Mask-mode R20: translucent copies of every model mesh (the layer-flash mechanism, on their own render order and polygon offset), sampling the labels by the model's UVs with
 * nearest filtering and the palette by label. It patches no model material, so it works in every shading look and while a set swaps the model's material.
 */
export function createMaskOverlay(root: Object3D): MaskOverlay {
  let copies: Mesh[] = [];
  let material: ShaderMaterial | null = null;
  let texture: DataTexture | null = null;
  let shownLabels: Uint8Array | null = null;
  let shownPalette: MaskOverlayState['palette'] | null = null;

  const clear = (): void => {
    copies.forEach((copy) => copy.removeFromParent());
    copies = [];
    material?.dispose();
    texture?.dispose();
    material = null;
    texture = null;
    shownLabels = null;
    shownPalette = null;
  };

  const build = (state: MaskOverlayState): void => {
    clear();
    texture = new DataTexture(state.labels as Uint8Array<ArrayBuffer>, state.size, state.size, RedFormat, UnsignedByteType);
    texture.magFilter = NearestFilter;
    texture.minFilter = NearestFilter;
    texture.generateMipmaps = false;
    texture.unpackAlignment = 1;
    texture.flipY = false;
    texture.needsUpdate = true;
    material = new ShaderMaterial({
      vertexShader: VERTEX,
      fragmentShader: FRAGMENT,
      uniforms: { uLabels: { value: texture }, uPalette: { value: paletteVectors(state.palette) }, uPaletteSize: { value: Math.min(state.palette.length, MAX_PALETTE_ENTRIES) }, uOpacity: { value: state.opacity }, uHighlight: { value: -1 } },
      transparent: true,
      depthWrite: false,
      polygonOffset: true,
      polygonOffsetFactor: -2,
      polygonOffsetUnits: -2,
    });
    const targets: Mesh[] = [];
    root.traverse((object) => {
      if (isModelMesh(object)) targets.push(object);
    });
    for (const mesh of targets) {
      const copy = createOverlayMesh(mesh, material);
      copy.userData['isMaskOverlay'] = true;
      copy.renderOrder = MASK_OVERLAY_RENDER_ORDER;
      mesh.add(copy);
      copies.push(copy);
    }
    shownLabels = state.labels;
    shownPalette = state.palette;
  };

  return {
    set(state) {
      if (state === null) return clear();
      if (state.labels !== shownLabels || state.palette !== shownPalette || material === null) build(state);
      const shown = material as ShaderMaterial | null;
      if (shown === null) return;
      shown.uniforms['uOpacity']!.value = state.opacity;
      shown.uniforms['uHighlight']!.value = state.highlight ?? -1;
      for (const copy of copies) copy.visible = state.on;
      return undefined;
    },
    dispose: clear,
  };
}
