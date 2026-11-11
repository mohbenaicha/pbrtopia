import { ShaderMaterial, Vector2, Vector3, type DataTexture, type IUniform } from 'three';
import type { MapAdjustUniforms } from '@shared/viewport';
import { ORM_DEFAULTS } from '@mat/workerapi';
import { FLAT_VIEWS, type FlatView } from '../math/flatViews';
import type { MaskUniforms } from './createMaskOverlay';
import type { ToolUniforms } from './createToolShading';
import { MISSING_ALBEDO, type PreviewMaterial, type PreviewTextureSlot } from './createPreviewMaterial';
import { FLAT_CHANNEL_FRAGMENT_SHADER, FLAT_COLOR_FRAGMENT_SHADER, FLAT_NORMAL_FRAGMENT_SHADER, FLAT_VERTEX_SHADER } from './flatShaders';

export interface FlatLooks {
  materialFor(view: FlatView): ShaderMaterial;
  sync(preview: PreviewMaterial): void; // the maps, tiling and displacement of the Shaded material now bound (R51, R52)
  dispose(): void;
}

interface ChannelView {
  slot: PreviewTextureSlot;
  channel: Vector3;
  fallback: number; // what the missing map shows (R45), as a 0..1 grey
  adjust: 'rough' | 'metal' | null; // the Strength and Contrast the Shaded view uses (R13); Height and AO have none
}

const CHANNEL_VIEWS: Record<'rough' | 'metal' | 'height' | 'ao', ChannelView> = {
  rough: { slot: 'orm', channel: new Vector3(0, 1, 0), fallback: ORM_DEFAULTS.rough / 255, adjust: 'rough' },
  metal: { slot: 'orm', channel: new Vector3(0, 0, 1), fallback: ORM_DEFAULTS.metal / 255, adjust: 'metal' },
  height: { slot: 'height', channel: new Vector3(1, 0, 0), fallback: 128 / 255, adjust: null }, // a height of 128 is flat at the default level
  ao: { slot: 'orm', channel: new Vector3(1, 0, 0), fallback: ORM_DEFAULTS.ao / 255, adjust: null },
};

const constant = (value: number): IUniform<number> => ({ value });

/**
 * Preview R51, R52: one unlit material per flat view. All six share the vertex uniforms (tiling, height map, displacement), so the mesh keeps its shape when the mode
 * changes; `sync` copies them from the Shaded material after every bind or value change, which keeps the two views from ever disagreeing.
 */
export function createFlatLooks(adjust: MapAdjustUniforms, mask: MaskUniforms, tool: ToolUniforms): FlatLooks {
  const shared = {
    uHeight: { value: null as DataTexture | null },
    uHasHeight: { value: false },
    uTile: { value: new Vector2(1, 1) },
    uDisplacementScale: constant(0),
    uDisplacementBias: constant(0),
    uToolMode: tool.uToolMode, // the transform of an open Crop or Mirror (imageops R53), read by every flat shader
    uToolRect: tool.uToolRect,
    uToolPlan: tool.uToolPlan,
    uToolMarks: tool.uToolMarks,
    uToolTile: tool.uToolTile, // the maps read by position (R57) use the tiling and the repeat of the Shaded view
    uTriplanar: tool.uTriplanar,
    uNormalFlipY: tool.uNormalFlipY,
  };
  const build = (fragmentShader: string, own: Record<string, IUniform>): ShaderMaterial =>
    new ShaderMaterial({ vertexShader: FLAT_VERTEX_SHADER, fragmentShader, uniforms: { ...shared, uMap: { value: null }, uHasMap: { value: false }, ...own }, toneMapped: false });

  const channelLook = (view: keyof typeof CHANNEL_VIEWS): ShaderMaterial => {
    const { channel, fallback, adjust: control } = CHANNEL_VIEWS[view];
    const strength = control === null ? constant(1) : adjust[`${control}Strength`];
    const contrast = control === null ? constant(1) : adjust[`${control}Contrast`];
    return build(FLAT_CHANNEL_FRAGMENT_SHADER, { uChannel: { value: channel }, uFallback: constant(fallback), uStrength: strength, uContrast: contrast });
  };

  const materials: Record<FlatView, ShaderMaterial> = {
    albedo: build(FLAT_COLOR_FRAGMENT_SHADER, { uFallbackColor: { value: MISSING_ALBEDO }, uMaskLabels: mask.uMaskLabels, uMaskPalette: mask.uMaskPalette, uMaskOpacity: mask.uMaskOpacity, uMaskOn: mask.uMaskOn }), // R18: the overlay shows on the albedo
    normal: build(FLAT_NORMAL_FRAGMENT_SHADER, { uStrength: adjust.normalStrength, uContrast: adjust.normalContrast }),
    rough: channelLook('rough'),
    metal: channelLook('metal'),
    height: channelLook('height'),
    ao: channelLook('ao'),
  };

  return {
    materialFor: (view) => materials[view],
    sync(preview) {
      const { textures, material } = preview;
      shared.uHeight.value = textures.height ?? null;
      shared.uHasHeight.value = textures.height !== undefined;
      shared.uTile.value.set(preview.values.tilingX, preview.values.tilingY); // the values, not a bound texture's repeat: with no map bound the overlay still follows them
      shared.uDisplacementScale.value = material.displacementScale;
      shared.uDisplacementBias.value = material.displacementBias;
      const show = (view: FlatView, slot: PreviewTextureSlot): void => {
        const texture = textures[slot] ?? null;
        materials[view].uniforms.uMap!.value = texture;
        materials[view].uniforms.uHasMap!.value = texture !== null;
      };
      show('albedo', 'albedo');
      show('normal', 'normal');
      for (const view of ['rough', 'metal', 'height', 'ao'] as const) show(view, CHANNEL_VIEWS[view].slot);
    },
    dispose() {
      for (const view of FLAT_VIEWS) materials[view].dispose();
    },
  };
}
