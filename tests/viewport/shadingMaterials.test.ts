import { BackSide, Color, DoubleSide, MeshBasicMaterial, MeshStandardMaterial, ShaderMaterial, Texture, Vector3 } from 'three';
import { describe, expect, it } from 'vitest';
import { createMapAdjustUniforms } from '../../src/viewport/mapAdjustUniforms';
import { createAlbedoLook, createChannelLook, createNormalLook } from '../../src/viewport/shadingMaterials';

const pictureOf = (): Texture => new Texture({ width: 4, height: 4 } as unknown as HTMLImageElement);

describe('createAlbedoLook', () => {
  it('viewport-layout R15 is an unlit copy of the colour map and colour that ignores tone mapping', () => {
    const source = new MeshStandardMaterial({ color: new Color(0.2, 0.4, 0.6), map: pictureOf() });
    const look = createAlbedoLook(source);
    expect(look).toBeInstanceOf(MeshBasicMaterial);
    expect(look.map).toBe(source.map);
    expect(look.color.equals(source.color)).toBe(true);
    expect(look.toneMapped).toBe(false);
  });

  it('viewport-layout R15 keeps the side, transparency, opacity and alpha settings of the source material', () => {
    const alphaMap = pictureOf();
    const source = new MeshStandardMaterial({ side: DoubleSide, transparent: true, opacity: 0.4, alphaMap, alphaTest: 0.3, vertexColors: true });
    const look = createAlbedoLook(source);
    expect([look.side, look.transparent, look.opacity, look.alphaTest, look.vertexColors]).toEqual([DoubleSide, true, 0.4, 0.3, true]);
    expect(look.alphaMap).toBe(alphaMap);
  });

  it('viewport-layout R15 a source without a colour or map still gives a plain white unlit material', () => {
    const look = createAlbedoLook({ side: BackSide, transparent: false, opacity: 1 } as unknown as MeshStandardMaterial);
    expect(look.map).toBeNull();
    expect(look.color.getHex()).toBe(0xffffff);
    expect(look.side).toBe(BackSide);
    expect(look.alphaTest).toBe(0);
    expect(look.vertexColors).toBe(false);
  });
});

describe('createNormalLook', () => {
  it('viewport-layout R15 shows the stored normal map as it is, with the map bound and no tone mapping', () => {
    const normalMap = pictureOf();
    const look = createNormalLook(new MeshStandardMaterial({ normalMap, side: DoubleSide }));
    expect(look).toBeInstanceOf(ShaderMaterial);
    expect(look.uniforms.uMap!.value).toBe(normalMap);
    expect(look.uniforms.uHasMap!.value).toBe(true);
    expect(look.toneMapped).toBe(false);
    expect(look.side).toBe(DoubleSide);
  });

  it('viewport-layout R15 a material without a normal map falls back to the flat normal (128, 128, 255)', () => {
    const look = createNormalLook(new MeshStandardMaterial());
    expect(look.uniforms.uHasMap!.value).toBe(false);
    expect(look.uniforms.uMap!.value).toBeNull();
    expect(look.fragmentShader).toContain('vec4(128.0 / 255.0, 128.0 / 255.0, 1.0, 1.0)');
  });

  it('viewport-layout R15 carries the map UV transform of the texture (offset and repeat), identity when there is no map', () => {
    const normalMap = pictureOf();
    normalMap.repeat.set(2, 3);
    normalMap.offset.set(0.5, 0.25);
    const look = createNormalLook(new MeshStandardMaterial({ normalMap }));
    const elements = look.uniforms.uUvTransform!.value.elements;
    expect(elements[0]).toBeCloseTo(2, 6);
    expect(elements[4]).toBeCloseTo(3, 6);
    expect(elements[6]).toBeCloseTo(0.5, 6);
    expect(elements[7]).toBeCloseTo(0.25, 6);
    const flat = createNormalLook(new MeshStandardMaterial());
    expect(flat.uniforms.uUvTransform!.value.elements).toEqual([1, 0, 0, 0, 1, 0, 0, 0, 1]);
  });
});

describe('createChannelLook', () => {
  it('viewport-layout R15 roughness reads the green channel of its map and metalness the blue one', () => {
    const adjust = createMapAdjustUniforms();
    const source = new MeshStandardMaterial({ roughnessMap: pictureOf(), metalnessMap: pictureOf() });
    const rough = createChannelLook(source, 'rough', adjust);
    const metal = createChannelLook(source, 'metal', adjust);
    expect((rough.uniforms.uChannel!.value as Vector3).toArray()).toEqual([0, 1, 0]);
    expect((metal.uniforms.uChannel!.value as Vector3).toArray()).toEqual([0, 0, 1]);
    expect(rough.uniforms.uMap!.value).toBe(source.roughnessMap);
    expect(metal.uniforms.uMap!.value).toBe(source.metalnessMap);
    expect(rough.toneMapped).toBe(false);
  });

  it('viewport-layout R15 the factor of the original material feeds the look, and defaults to 1 when there is none', () => {
    const adjust = createMapAdjustUniforms();
    const source = new MeshStandardMaterial({ roughness: 0.25, metalness: 0.75 });
    expect(createChannelLook(source, 'rough', adjust).uniforms.uFactor!.value).toBe(0.25);
    expect(createChannelLook(source, 'metal', adjust).uniforms.uFactor!.value).toBe(0.75);
    const bare = { side: 0 } as unknown as MeshStandardMaterial;
    expect(createChannelLook(bare, 'rough', adjust).uniforms.uFactor!.value).toBe(1);
    expect(createChannelLook(bare, 'metal', adjust).uniforms.uFactor!.value).toBe(1);
    expect(createChannelLook(bare, 'rough', adjust).uniforms.uHasMap!.value).toBe(false);
  });

  it('viewport-layout R14 the strength and contrast uniforms are the shared slider uniforms, so a slider moves the look without a rebuild', () => {
    const adjust = createMapAdjustUniforms();
    const source = new MeshStandardMaterial();
    const rough = createChannelLook(source, 'rough', adjust);
    const metal = createChannelLook(source, 'metal', adjust);
    expect(rough.uniforms.uStrength).toBe(adjust.roughStrength);
    expect(rough.uniforms.uContrast).toBe(adjust.roughContrast);
    expect(metal.uniforms.uStrength).toBe(adjust.metalStrength);
    expect(metal.uniforms.uContrast).toBe(adjust.metalContrast);
    adjust.roughStrength.value = 2.5;
    expect(rough.uniforms.uStrength!.value).toBe(2.5);
    expect(metal.uniforms.uStrength!.value).not.toBe(2.5);
  });
});
