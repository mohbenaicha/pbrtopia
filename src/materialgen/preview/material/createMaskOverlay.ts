import { DataTexture, NearestFilter, NoColorSpace, RGBAFormat, SRGBColorSpace, UnsignedByteType, Vector2, type IUniform, type Material, type WebGLProgramParametersWithUniforms, type WebGLRenderer } from 'three';
import type { PaletteEntry, PixelImage } from '@mat/workerapi';
import { MASK_UNIFORMS, PALETTE_SIZE, maskMixFor } from './maskShader';
import { createPixelTexture, toRgbaBytes } from './pixelTexture';

export interface MaskOverlaySettings {
  on: boolean; // the toggle (session-only, preview R40)
  opacity: number; // 0..1, how much of the palette colour replaces the albedo
  palette: readonly PaletteEntry[] | null; // null: the material has no masks record
}

export type MaskUniforms = {
  uMaskLabels: IUniform<DataTexture | null>;
  uMaskPalette: IUniform<DataTexture>;
  uMaskOpacity: IUniform<number>;
  uMaskOn: IUniform<number>;
  uMaskTile: IUniform<Vector2>;
};

export interface MaskOverlay {
  readonly uniforms: MaskUniforms; // shared by the shaded material and the flat Albedo view
  setLabels(picture: PixelImage | undefined): void; // the working copy of the labels map; rebuilt only for a different picture
  setSettings(settings: MaskOverlaySettings): void;
  setTile(x: number, y: number): void; // the labels repeat with the albedo
  patchLitMaterial(material: Material): void; // adds the overlay to the albedo of the shaded material, before any other patch of its shader
  dispose(): void;
}

const CACHE_KEY_SUFFIX = 'mask-overlay';
const VERTEX_DECLARATIONS = 'uniform vec2 uMaskTile;\nvarying vec2 vMaskUv;\n';
const FRAGMENT_DECLARATIONS = `${MASK_UNIFORMS}varying vec2 vMaskUv;\n`;

const hexByte = (hex: string, at: number): number => Number.parseInt(hex.slice(1 + at * 2, 3 + at * 2), 16) || 0;

function buildPaletteTexture(palette: readonly PaletteEntry[] | null): DataTexture {
  const bytes = new Uint8Array(PALETTE_SIZE * 4);
  for (const entry of palette ?? []) {
    if (entry.label < 0 || entry.label >= PALETTE_SIZE) continue;
    bytes.set([hexByte(entry.hex, 0), hexByte(entry.hex, 1), hexByte(entry.hex, 2), 255], entry.label * 4);
  }
  const texture = new DataTexture(bytes, PALETTE_SIZE, 1, RGBAFormat, UnsignedByteType);
  texture.colorSpace = SRGBColorSpace; // the colours are stored as the sRGB the person sees; the shader works in linear
  texture.minFilter = NearestFilter;
  texture.magFilter = NearestFilter;
  texture.generateMipmaps = false;
  texture.needsUpdate = true;
  return texture;
}

/**
 * Preview R18, R40: draws the label palette colours into the albedo by the overlay opacity, on the GPU, so moving the opacity slider rebuilds nothing. The overlay is
 * display only: the albedo map and every stored file are untouched. It is on only while the switch is on and both the labels and the palette exist.
 */
export function createMaskOverlay(): MaskOverlay {
  const uniforms: MaskUniforms = {
    uMaskLabels: { value: null },
    uMaskPalette: { value: buildPaletteTexture(null) },
    uMaskOpacity: { value: 0.5 },
    uMaskOn: { value: 0 },
    uMaskTile: { value: new Vector2(1, 1) },
  };
  let source: PixelImage | undefined;
  let switchedOn = false;
  let hasPalette = false;
  let builtFrom: readonly PaletteEntry[] | null = null; // the palette the colour table was built from; only a different one rebuilds it

  const refreshOn = (): void => {
    uniforms.uMaskOn.value = switchedOn && hasPalette && uniforms.uMaskLabels.value !== null ? 1 : 0;
  };

  return {
    uniforms,
    setLabels(picture) {
      if (picture === source) return;
      source = picture;
      uniforms.uMaskLabels.value?.dispose();
      uniforms.uMaskLabels.value = picture === undefined ? null : createPixelTexture(toRgbaBytes(picture), picture.width, picture.height, NoColorSpace, true);
      refreshOn();
    },
    setSettings({ on, opacity, palette }) {
      switchedOn = on;
      hasPalette = palette !== null && palette.length > 0;
      uniforms.uMaskOpacity.value = Math.min(1, Math.max(0, opacity));
      if (palette !== builtFrom) {
        builtFrom = palette;
        uniforms.uMaskPalette.value.dispose();
        uniforms.uMaskPalette.value = buildPaletteTexture(palette);
      }
      refreshOn();
    },
    setTile(x, y) {
      uniforms.uMaskTile.value.set(x, y);
    },
    patchLitMaterial(material) {
      const lit = material as Material & { onBeforeCompile: (shader: WebGLProgramParametersWithUniforms, renderer: WebGLRenderer) => void; customProgramCacheKey(): string };
      const previous = lit.onBeforeCompile;
      const previousKey = lit.customProgramCacheKey;
      lit.onBeforeCompile = (shader, renderer) => {
        previous.call(lit, shader, renderer);
        Object.assign(shader.uniforms, uniforms);
        shader.vertexShader = VERTEX_DECLARATIONS + shader.vertexShader.replace('#include <uv_vertex>', '#include <uv_vertex>\n  vMaskUv = uv * uMaskTile;');
        shader.fragmentShader = FRAGMENT_DECLARATIONS + shader.fragmentShader.replace('#include <map_fragment>', `#include <map_fragment>${maskMixFor('vMaskUv', 'diffuseColor.rgb')}`);
      };
      lit.customProgramCacheKey = () => `${previousKey.call(lit)}|${CACHE_KEY_SUFFIX}`;
      lit.needsUpdate = true;
    },
    dispose() {
      uniforms.uMaskLabels.value?.dispose();
      uniforms.uMaskPalette.value.dispose();
    },
  };
}
