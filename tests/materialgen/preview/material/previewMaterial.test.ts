import { Color, FrontSide, NoColorSpace, RepeatWrapping, SRGBColorSpace, type DataTexture } from 'three';
import { describe, expect, it } from 'vitest';
import { DEFAULT_PREVIEW_VALUES } from '@mat/storage';
import { createPreviewMaterial } from '../../../../src/materialgen/preview/material/createPreviewMaterial';
import type { PreviewMaps } from '../../../../src/materialgen/preview/material/previewMaps';

const grey = (value: number, side = 2) => ({ width: side, height: side, channels: 1 as const, data: new Uint8Array(side * side).fill(value) });
const rgb = (r: number, g: number, b: number, side = 2) => {
  const data = new Uint8Array(side * side * 3);
  for (let i = 0; i < side * side; i += 1) data.set([r, g, b], i * 3);
  return { width: side, height: side, channels: 3 as const, data };
};
const texel = (texture: DataTexture, index = 0): number[] => [...(texture.image.data as Uint8Array).slice(index * 4, index * 4 + 4)];
const disposed = (texture: DataTexture): { value: boolean } => {
  const flag = { value: false };
  texture.addEventListener('dispose', () => (flag.value = true));
  return flag;
};

describe('materialgen/preview R2 faces', () => {
  it('R2 the material itself is drawn on its outer faces; the scene makes it double-sided for the Plane (previewScene tests)', () => {
    expect(createPreviewMaterial().material.side).toBe(FrontSide);
  });
});

describe('materialgen/preview R45 R46 missing maps', () => {
  it('R45 a material with no maps is mid-grey albedo, flat normal, roughness 0.5, metalness 0, no relief and no occlusion', () => {
    const { material } = createPreviewMaterial();
    const grey128 = new Color().setRGB(128 / 255, 128 / 255, 128 / 255, SRGBColorSpace);
    expect(material.map).toBeNull();
    expect(material.color.r).toBeCloseTo(grey128.r, 6);
    expect(material.normalMap).toBeNull();
    expect(material.roughnessMap).toBeNull();
    expect(material.roughness).toBe(0.5);
    expect(material.metalness).toBe(0);
    expect(material.aoMap).toBeNull();
    expect(material.displacementMap).toBeNull();
    expect(material.displacementScale).toBe(0);
    expect(material.displacementBias).toBe(0);
  });

  it('R46 with only an albedo the mesh shows that albedo and the defaults of R45 for the rest', () => {
    const preview = createPreviewMaterial();
    preview.bind({ albedo: rgb(10, 20, 30) });
    expect(preview.material.map).not.toBeNull();
    expect(preview.material.color.getHex()).toBe(0xffffff); // the map is not tinted
    expect(preview.material.roughness).toBe(0.5);
    expect(preview.material.metalness).toBe(0);
    expect(preview.material.normalMap).toBeNull();
    expect(preview.material.displacementMap).toBeNull();
  });
});

describe('materialgen/preview R8 R10 R11 R12 texture binding', () => {
  it('R8 albedo is sRGB; normal, ORM and height have no colour space; all repeat and use mipmaps', () => {
    const preview = createPreviewMaterial();
    preview.bind({ albedo: rgb(1, 2, 3), normal: rgb(128, 128, 255), height: grey(90), rough: grey(10) });
    const { material } = preview;
    expect((material.map as DataTexture).colorSpace).toBe(SRGBColorSpace);
    for (const texture of [material.normalMap, material.roughnessMap, material.displacementMap] as DataTexture[]) {
      expect(texture.colorSpace).toBe(NoColorSpace);
    }
    for (const texture of [material.map, material.normalMap, material.roughnessMap, material.displacementMap] as DataTexture[]) {
      expect(texture.wrapS).toBe(RepeatWrapping);
      expect(texture.wrapT).toBe(RepeatWrapping);
      expect(texture.generateMipmaps).toBe(true);
    }
  });

  it('R10 rough, metal and ao are one packed texture: R = ao, G = rough, B = metal, bound as ao, roughness and metalness map', () => {
    const preview = createPreviewMaterial();
    preview.bind({ ao: grey(200), rough: grey(100), metal: grey(50) });
    const { material } = preview;
    expect(material.aoMap).not.toBeNull();
    expect(material.roughnessMap).toBe(material.aoMap);
    expect(material.metalnessMap).toBe(material.aoMap);
    expect(texel(material.aoMap as DataTexture)).toEqual([200, 100, 50, 255]);
  });

  it('R11 a missing channel is filled with the shared default: ao 255, rough 128, metal 0', () => {
    const preview = createPreviewMaterial();
    preview.bind({ rough: grey(30) });
    expect(texel(preview.material.aoMap as DataTexture)).toEqual([255, 30, 0, 255]);
    preview.bind({ metal: grey(250) });
    expect(texel(preview.material.aoMap as DataTexture)).toEqual([255, 128, 250, 255]);
  });

  it('R12 the scalars are 1 when a packed texture is bound, so a metal map of 255 is full metal with no slider touched', () => {
    const preview = createPreviewMaterial();
    preview.bind({ metal: grey(255), rough: grey(0) });
    expect(preview.material.metalness).toBe(1);
    expect(preview.material.roughness).toBe(1);
  });

  it('R12 only a rough map: the metal channel keeps its default of 0', () => {
    const preview = createPreviewMaterial();
    preview.bind({ rough: grey(200) });
    expect(texel(preview.material.metalnessMap as DataTexture)[2]).toBe(0);
  });

  it('R14 AO intensity sets the occlusion strength of the packed texture', () => {
    const preview = createPreviewMaterial();
    preview.bind({ ao: grey(100) });
    preview.setAoIntensity(0);
    expect(preview.material.aoMapIntensity).toBe(0);
    preview.setAoIntensity(2);
    expect(preview.material.aoMapIntensity).toBe(2);
  });

  it('R10 maps of different sizes are packed at one size without failing', () => {
    const preview = createPreviewMaterial();
    preview.bind({ ao: grey(255, 4), rough: grey(10, 2), metal: grey(20, 8) });
    const orm = preview.material.aoMap as DataTexture;
    expect(orm.image.width).toBe(8);
    expect(orm.image.height).toBe(8);
  });
});

describe('materialgen/preview R15 R17 values on the material', () => {
  it('R17 tiling repeats every bound texture independently on U and V, and no texture is copied', () => {
    const preview = createPreviewMaterial();
    preview.bind({ albedo: rgb(1, 1, 1), normal: rgb(128, 128, 255), height: grey(200), ao: grey(255) });
    preview.setValues({ ...DEFAULT_PREVIEW_VALUES, tilingX: 4, tilingY: 1 });
    for (const texture of [preview.material.map, preview.material.normalMap, preview.material.displacementMap, preview.material.aoMap] as DataTexture[]) {
      expect(texture.repeat.toArray()).toEqual([4, 1]);
    }
  });

  it('R17 textures bound after the tiling was set get that tiling', () => {
    const preview = createPreviewMaterial();
    preview.setValues({ ...DEFAULT_PREVIEW_VALUES, tilingX: 3, tilingY: 2 });
    preview.bind({ albedo: rgb(1, 1, 1) });
    expect((preview.material.map as DataTexture).repeat.toArray()).toEqual([3, 2]);
  });

  it('R15 R16 height drives displacement scale and bias; with height missing nothing moves', () => {
    const preview = createPreviewMaterial();
    preview.setValues({ ...DEFAULT_PREVIEW_VALUES, heightScale: 0.1 });
    expect(preview.material.displacementScale).toBe(0);
    preview.bind({ height: grey(255) });
    expect(preview.material.displacementScale).toBeCloseTo(0.1, 12);
    expect(preview.material.displacementBias).toBeCloseTo(-0.05, 12);
    preview.bind({});
    expect(preview.material.displacementScale).toBe(0);
    expect(preview.material.displacementBias).toBe(0);
  });
});

describe('materialgen/preview R7 R19 R48 replacing and clearing', () => {
  it('R19 a replaced working copy shows the new picture and releases the old texture', () => {
    const preview = createPreviewMaterial();
    preview.bind({ albedo: rgb(1, 1, 1) });
    const old = preview.material.map as DataTexture;
    const released = disposed(old);
    preview.bind({ albedo: rgb(9, 9, 9) });
    expect(released.value).toBe(true);
    expect(preview.material.map).not.toBe(old);
    expect(texel(preview.material.map as DataTexture)).toEqual([9, 9, 9, 255]);
  });

  it('R19 an unchanged working copy keeps its texture (no rebuild)', () => {
    const preview = createPreviewMaterial();
    const maps: PreviewMaps = { albedo: rgb(1, 1, 1), ao: grey(5) };
    preview.bind(maps);
    const albedo = preview.material.map;
    const orm = preview.material.aoMap;
    preview.bind({ ...maps });
    expect(preview.material.map).toBe(albedo);
    expect(preview.material.aoMap).toBe(orm);
  });

  it('R19 the packed texture is rebuilt only when ao, rough or metal change', () => {
    const preview = createPreviewMaterial();
    const ao = grey(5);
    preview.bind({ albedo: rgb(1, 1, 1), ao });
    const orm = preview.material.aoMap;
    preview.bind({ albedo: rgb(2, 2, 2), ao });
    expect(preview.material.aoMap).toBe(orm);
    preview.bind({ albedo: rgb(2, 2, 2), ao: grey(6) });
    expect(preview.material.aoMap).not.toBe(orm);
  });

  it('R19 at most one texture per map kind and one packed texture are resident', () => {
    const preview = createPreviewMaterial();
    preview.bind({ albedo: rgb(1, 1, 1), normal: rgb(1, 1, 1), height: grey(1), ao: grey(1), rough: grey(1), metal: grey(1) });
    expect(preview.textureCount()).toBe(4);
    preview.bind({ albedo: rgb(2, 2, 2), normal: rgb(2, 2, 2), height: grey(2), ao: grey(2), rough: grey(2), metal: grey(2) });
    expect(preview.textureCount()).toBe(4);
  });

  it('R48 a cleared map shows its default on the next bind and its texture is released', () => {
    const preview = createPreviewMaterial();
    preview.bind({ albedo: rgb(1, 1, 1), rough: grey(10) });
    const albedo = preview.material.map as DataTexture;
    const orm = preview.material.roughnessMap as DataTexture;
    const albedoReleased = disposed(albedo);
    const ormReleased = disposed(orm);
    preview.bind({});
    expect(albedoReleased.value).toBe(true);
    expect(ormReleased.value).toBe(true);
    expect(preview.material.map).toBeNull();
    expect(preview.material.roughnessMap).toBeNull();
    expect(preview.material.roughness).toBe(0.5);
    expect(preview.material.metalness).toBe(0);
  });

  it('R6 disposing releases every texture and the material', () => {
    const preview = createPreviewMaterial();
    preview.bind({ albedo: rgb(1, 1, 1), height: grey(1), ao: grey(1) });
    const textures = [preview.material.map, preview.material.displacementMap, preview.material.aoMap] as DataTexture[];
    const flags = textures.map(disposed);
    let materialDisposed = false;
    preview.material.addEventListener('dispose', () => (materialDisposed = true));
    preview.dispose();
    expect(flags.map((flag) => flag.value)).toEqual([true, true, true]);
    expect(materialDisposed).toBe(true);
    expect(preview.textureCount()).toBe(0);
  });
});
