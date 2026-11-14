import { Color, MeshPhysicalMaterial, NoColorSpace, SRGBColorSpace, type DataTexture, type Texture } from 'three';
import { DEFAULT_PREVIEW_VALUES, type PreviewValues } from '@mat/storage';
import { ORM_DEFAULTS, type PixelImage } from '@mat/workerapi';
import { displacementFor } from '../math/displacement';
import { packOrmBytes } from './packOrmBytes';
import { createPixelTexture, toRgbaBytes } from './pixelTexture';
import type { PreviewMaps } from './previewMaps';

export type PreviewTextureSlot = 'albedo' | 'normal' | 'height' | 'orm';
type Slot = PreviewTextureSlot;

export interface PreviewMaterial {
  readonly material: MeshPhysicalMaterial; // the one material all three preview meshes share (preview R7)
  readonly textures: Readonly<Partial<Record<PreviewTextureSlot, Texture>>>; // what is bound now; the flat views (R51) draw the same ones
  readonly values: PreviewValues; // the tiling and height values now applied (R15, R17)
  bind(maps: PreviewMaps): void; // the working copies now shown; a map that is absent shows its default (R45, R48)
  /** Compositing R25: textures that stand in for the stored ones of their slot while a painting session is open (null puts the stored ones back); the owner disposes them. */
  setOverrides(overrides: Readonly<Partial<Record<PreviewTextureSlot, Texture>>> | null): void;
  setValues(values: PreviewValues): void; // tiling and height values (R15, R17)
  setAoIntensity(intensity: number): void; // R14
  textureCount(): number;
  dispose(): void;
}

export const MISSING_ALBEDO = new Color().setRGB(128 / 255, 128 / 255, 128 / 255, SRGBColorSpace); // preview R45: sRGB 128
const MISSING_ROUGHNESS = 0.5; // preview R45 (the packed default of 128 is the same value to one byte)
const MISSING_METALNESS = ORM_DEFAULTS.metal / 255;

/**
 * Preview R7-R12, R14-R17, R19, R45-R48: builds the shared physical material and keeps at most one texture per map kind plus the one packed
 * ORM texture (ao, rough, metal). Binding compares the pictures by identity, so only a working copy that changed makes a texture. An open Crop or Mirror
 * (R58) makes no texture: it is a transform in the shaders.
 */
export function createPreviewMaterial(): PreviewMaterial {
  const material = new MeshPhysicalMaterial({ color: MISSING_ALBEDO, roughness: MISSING_ROUGHNESS, metalness: MISSING_METALNESS }); // the side is set by the scene from the mesh (R2)
  const owned: Partial<Record<Slot, DataTexture>> = {}; // made from the stored pictures
  const textures: Partial<Record<Slot, Texture>> = {}; // what is bound now: the owned ones, with an open painting session's standing in
  const sources: Partial<Record<keyof PreviewMaps, PixelImage>> = {}; // the pictures the textures were last made from
  let overrides: Readonly<Partial<Record<Slot, Texture>>> = {};
  let values: PreviewValues = DEFAULT_PREVIEW_VALUES;

  const SLOTS: readonly Slot[] = ['albedo', 'normal', 'height', 'orm'];
  const refresh = (): void => {
    for (const slot of SLOTS) {
      const shown = overrides[slot] ?? owned[slot];
      if (shown === undefined) delete textures[slot];
      else textures[slot] = shown;
    }
  };
  const release = (slot: Slot): void => {
    owned[slot]?.dispose();
    delete owned[slot];
  };

  const place = (slot: 'albedo' | 'normal' | 'height', image: PixelImage | undefined, colorSpace: typeof SRGBColorSpace | typeof NoColorSpace): void => {
    if (sources[slot] === image) return;
    if (image === undefined) delete sources[slot];
    else sources[slot] = image;
    release(slot);
    if (image !== undefined) owned[slot] = createPixelTexture(toRgbaBytes(image), image.width, image.height, colorSpace);
  };

  const placeOrm = (maps: PreviewMaps): void => {
    if (sources.ao === maps.ao && sources.rough === maps.rough && sources.metal === maps.metal) return;
    for (const key of ['ao', 'rough', 'metal'] as const) {
      const picture = maps[key];
      if (picture === undefined) delete sources[key];
      else sources[key] = picture;
    }
    release('orm');
    const packed = packOrmBytes(maps);
    if (packed !== null) owned.orm = createPixelTexture(packed.rgba, packed.side, packed.side, NoColorSpace);
  };

  const applyValues = (): void => {
    for (const texture of Object.values(textures)) texture.repeat.set(values.tilingX, values.tilingY);
    const displacement = displacementFor(values, textures.height !== undefined);
    material.displacementScale = displacement.scale;
    material.displacementBias = displacement.bias;
  };

  const applyBindings = (): void => {
    const { albedo, normal, height, orm } = textures;
    const before = [material.map, material.normalMap, material.displacementMap, material.aoMap].map(Boolean).join();
    material.map = albedo ?? null;
    material.color.copy(albedo === undefined ? MISSING_ALBEDO : new Color(0xffffff)); // a map is not tinted
    material.normalMap = normal ?? null;
    material.displacementMap = height ?? null;
    material.aoMap = orm ?? null;
    material.roughnessMap = orm ?? null;
    material.metalnessMap = orm ?? null;
    material.roughness = orm === undefined ? MISSING_ROUGHNESS : 1; // R12: no hidden multiplier once a map exists
    material.metalness = orm === undefined ? MISSING_METALNESS : 1;
    if ([material.map, material.normalMap, material.displacementMap, material.aoMap].map(Boolean).join() !== before) material.needsUpdate = true;
  };

  applyValues(); // three's default displacement scale is 1; with no height map nothing may move (R16)

  return {
    material,
    textures,
    bind(maps) {
      place('albedo', maps.albedo, SRGBColorSpace);
      place('normal', maps.normal, NoColorSpace);
      place('height', maps.height, NoColorSpace);
      placeOrm(maps);
      refresh();
      applyBindings();
      applyValues();
    },
    setOverrides(next) {
      overrides = next ?? {};
      refresh();
      applyBindings();
      applyValues();
    },
    setValues(next) {
      values = next;
      applyValues();
    },
    setAoIntensity(intensity) {
      material.aoMapIntensity = intensity;
    },
    get values() {
      return values;
    },
    textureCount: () => Object.keys(textures).length,
    dispose() {
      for (const slot of SLOTS) release(slot);
      refresh();
      material.dispose();
    },
  };
}
