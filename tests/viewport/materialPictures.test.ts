import { Color, DataTexture, MeshBasicMaterial, MeshStandardMaterial, NoColorSpace, SRGBColorSpace, type Texture } from 'three';
import { describe, expect, it, vi } from 'vitest';
import { createMaterialPictures } from '../../src/viewport/materialPictures';

const bitmap = (): ImageBitmap => ({ width: 4, height: 4, close: vi.fn() }) as unknown as ImageBitmap;
const ownTexture = (): DataTexture => new DataTexture(new Uint8Array([10, 20, 30, 255]), 1, 1);

function twoMaterials() {
  const albedo = ownTexture();
  const first = new MeshStandardMaterial({ map: albedo, color: new Color(0x336699), roughness: 0.3, metalness: 0.6 });
  const second = new MeshStandardMaterial(); // no maps at all
  const onChanged = vi.fn();
  return { first, second, albedo, onChanged, pictures: createMaterialPictures([first, second], onChanged) };
}

describe('setMaterialPicture (textures R13)', () => {
  it('textures R13 an albedo picture replaces the colour map, unflipped and sRGB, with a white colour factor; null puts both back and leaves the file\'s own map alone', () => {
    const { first, albedo, pictures } = twoMaterials();
    const picture = bitmap();
    pictures.set(0, 'albedo', { id: 'p1', bitmap: picture });
    const shown = first.map as Texture;
    expect(shown).not.toBe(albedo);
    expect(shown.image).toBe(picture);
    expect(shown.flipY).toBe(false);
    expect(shown.colorSpace).toBe(SRGBColorSpace);
    expect(first.color.getHex()).toBe(0xffffff);
    const disposeShown = vi.spyOn(shown, 'dispose');
    const disposeOwn = vi.spyOn(albedo, 'dispose');
    pictures.set(0, 'albedo', null);
    expect(first.map).toBe(albedo);
    expect(first.color.getHex()).toBe(0x336699);
    expect(disposeShown).toHaveBeenCalledTimes(1);
    expect(disposeOwn).not.toHaveBeenCalled();
    expect(picture.close).toHaveBeenCalledTimes(1);
  });

  it('textures R13 a normal picture is linear and changes no factor', () => {
    const { first, pictures } = twoMaterials();
    pictures.set(0, 'normal', { id: 'n1', bitmap: bitmap() });
    const map = first.normalMap as Texture;
    expect(map.colorSpace).toBe(NoColorSpace);
    expect(map.flipY).toBe(false);
    expect([first.roughness, first.metalness, first.color.getHex()]).toEqual([0.3, 0.6, 0x336699]);
  });

  it('textures R13 a rough picture makes roughness 1 and a metal picture makes metalness 1 while they show, and the file\'s factors come back on null', () => {
    const { first, pictures } = twoMaterials();
    pictures.set(0, 'rough', { id: 'r1', bitmap: bitmap() });
    expect(first.roughnessMap).not.toBeNull();
    expect([first.roughness, first.metalness]).toEqual([1, 0.6]);
    pictures.set(0, 'metal', { id: 'm1', bitmap: bitmap() });
    expect(first.metalnessMap).not.toBeNull();
    expect([first.roughness, first.metalness]).toEqual([1, 1]);
    expect(first.metalnessMap!.colorSpace).toBe(NoColorSpace);
    pictures.set(0, 'rough', null);
    pictures.set(0, 'metal', null);
    expect([first.roughness, first.metalness]).toEqual([0.3, 0.6]);
    expect([first.roughnessMap, first.metalnessMap]).toEqual([null, null]);
  });

  it('textures R13 a material with no map for the channel gets one, and loses it again on null', () => {
    const { second, pictures } = twoMaterials();
    const before = second.version;
    pictures.set(1, 'albedo', { id: 'p1', bitmap: bitmap() });
    expect(second.map).not.toBeNull();
    expect(second.version).toBeGreaterThan(before); // a map that appears recompiles the material
    const mid = second.version;
    pictures.set(1, 'albedo', null);
    expect(second.map).toBeNull();
    expect(second.version).toBeGreaterThan(mid);
  });

  it('textures R13 one picture is one texture for every slot that shows it, disposed and its bitmap closed only when the last slot lets go', () => {
    const { first, second, pictures } = twoMaterials();
    const picture = bitmap();
    pictures.set(0, 'albedo', { id: 'p1', bitmap: picture });
    pictures.set(1, 'albedo', { id: 'p1', bitmap: bitmap() });
    expect(second.map).toBe(first.map);
    const dispose = vi.spyOn(first.map as Texture, 'dispose');
    pictures.set(0, 'albedo', null);
    expect(dispose).not.toHaveBeenCalled();
    expect(picture.close).not.toHaveBeenCalled();
    pictures.set(1, 'albedo', null);
    expect(dispose).toHaveBeenCalledTimes(1);
    expect(picture.close).toHaveBeenCalledTimes(1);
  });

  it('textures R13 a second bitmap handed in for a picture already held is closed, since the held texture is the one in use', () => {
    const { first, second, pictures } = twoMaterials();
    pictures.set(0, 'albedo', { id: 'p1', bitmap: bitmap() });
    const extra = bitmap();
    pictures.set(1, 'albedo', { id: 'p1', bitmap: extra });
    expect(extra.close).toHaveBeenCalledTimes(1);
    expect((first.map as Texture).image).not.toBe(extra);
    expect(second.map).toBe(first.map);
  });

  it('textures R13 changing the picture of a slot lets go of the old one and null restores the file\'s own map, not the previous picture', () => {
    const { first, albedo, pictures } = twoMaterials();
    const one = bitmap();
    const two = bitmap();
    pictures.set(0, 'albedo', { id: 'p1', bitmap: one });
    pictures.set(0, 'albedo', { id: 'p2', bitmap: two });
    expect((first.map as Texture).image).toBe(two);
    expect(one.close).toHaveBeenCalledTimes(1);
    pictures.set(0, 'albedo', null);
    expect(first.map).toBe(albedo);
    expect(two.close).toHaveBeenCalledTimes(1);
  });

  it('textures R13 the same picture set again on a slot changes nothing and does not tell the viewport', () => {
    const { pictures, onChanged } = twoMaterials();
    const picture = bitmap();
    pictures.set(0, 'albedo', { id: 'p1', bitmap: picture });
    onChanged.mockClear();
    const again = bitmap();
    pictures.set(0, 'albedo', { id: 'p1', bitmap: again });
    expect(onChanged).not.toHaveBeenCalled();
    expect(again.close).toHaveBeenCalledTimes(1);
    expect(picture.close).not.toHaveBeenCalled();
  });

  it('textures R13 every change tells the viewport once, and a null on a slot without an override does not', () => {
    const { pictures, onChanged } = twoMaterials();
    pictures.set(0, 'albedo', null);
    expect(onChanged).not.toHaveBeenCalled();
    pictures.set(0, 'albedo', { id: 'p1', bitmap: bitmap() });
    expect(onChanged).toHaveBeenCalledTimes(1);
    pictures.set(0, 'albedo', null);
    expect(onChanged).toHaveBeenCalledTimes(2);
  });

  it('textures R13 an unknown material index is ignored and its bitmap is closed', () => {
    const { pictures, onChanged } = twoMaterials();
    const stray = bitmap();
    pictures.set(7, 'albedo', { id: 'p1', bitmap: stray });
    pictures.set(-1, 'albedo', null);
    expect(stray.close).toHaveBeenCalledTimes(1);
    expect(onChanged).not.toHaveBeenCalled();
  });

  it('textures R13 a rejected slot never closes a bitmap that a held texture still uses', () => {
    const { pictures } = twoMaterials();
    const shared = bitmap();
    pictures.set(0, 'albedo', { id: 'p1', bitmap: shared });
    pictures.set(7, 'albedo', { id: 'p2', bitmap: shared });
    expect(shared.close).not.toHaveBeenCalled();
    pictures.set(0, 'albedo', null);
    expect(shared.close).toHaveBeenCalledTimes(1);
  });

  it('textures R13 a bitmap shared by several slots survives a first material that cannot show the channel, and shows on the next one', () => {
    const basic = new MeshBasicMaterial(); // no roughness map
    const standard = new MeshStandardMaterial();
    const pictures = createMaterialPictures([basic, standard], vi.fn());
    const shared = bitmap();
    pictures.set(0, 'rough', { id: 'r1', bitmap: shared });
    pictures.set(1, 'rough', { id: 'r1', bitmap: shared });
    expect(shared.close).not.toHaveBeenCalled();
    expect((standard.roughnessMap as Texture).image).toBe(shared);
    pictures.set(1, 'rough', null);
    expect(shared.close).toHaveBeenCalledTimes(1);
    pictures.set(0, 'rough', null);
    expect(shared.close).toHaveBeenCalledTimes(1);
  });

  it('textures R13 a bitmap no material can show is closed when its slot is cleared or the pictures are released, not before', () => {
    const basic = new MeshBasicMaterial();
    const pictures = createMaterialPictures([basic], vi.fn());
    const cleared = bitmap();
    pictures.set(0, 'rough', { id: 'r1', bitmap: cleared });
    expect(cleared.close).not.toHaveBeenCalled();
    pictures.set(0, 'rough', null);
    expect(cleared.close).toHaveBeenCalledTimes(1);
    const released = bitmap();
    pictures.set(0, 'rough', { id: 'r2', bitmap: released });
    pictures.release();
    expect(released.close).toHaveBeenCalledTimes(1);
  });

  it('textures R13 replacing the picture of a slot that cannot show it closes the old bitmap unless another slot still holds it', () => {
    const pictures = createMaterialPictures([new MeshBasicMaterial(), new MeshBasicMaterial()], vi.fn());
    const first = bitmap();
    const second = bitmap();
    pictures.set(0, 'rough', { id: 'r1', bitmap: first });
    pictures.set(1, 'rough', { id: 'r1', bitmap: first });
    pictures.set(0, 'rough', { id: 'r2', bitmap: second });
    expect(first.close).not.toHaveBeenCalled(); // slot 1 still holds it
    pictures.set(1, 'rough', null);
    expect(first.close).toHaveBeenCalledTimes(1);
  });

  it('textures R13 release puts every original back and frees only what the overrides made', () => {
    const { first, second, albedo, pictures } = twoMaterials();
    const one = bitmap();
    pictures.set(0, 'albedo', { id: 'p1', bitmap: one });
    pictures.set(0, 'rough', { id: 'r1', bitmap: bitmap() });
    pictures.set(1, 'albedo', { id: 'p1', bitmap: bitmap() });
    const disposeOwn = vi.spyOn(albedo, 'dispose');
    pictures.release();
    expect(first.map).toBe(albedo);
    expect([first.roughness, first.roughnessMap, first.color.getHex()]).toEqual([0.3, null, 0x336699]);
    expect(second.map).toBeNull();
    expect(one.close).toHaveBeenCalledTimes(1);
    expect(disposeOwn).not.toHaveBeenCalled();
  });

  it('textures R13 a material class without the property for a channel ignores that factor and still shows the map where it has one', () => {
    const basic = new MeshBasicMaterial({ color: 0x112233 });
    const pictures = createMaterialPictures([basic], vi.fn());
    pictures.set(0, 'rough', { id: 'r1', bitmap: bitmap() }); // a basic material has no roughness: nothing to show, nothing to break
    expect((basic as unknown as { roughnessMap?: Texture }).roughnessMap ?? null).toBeNull();
    pictures.set(0, 'albedo', { id: 'p1', bitmap: bitmap() });
    expect(basic.map).not.toBeNull();
    expect(basic.color.getHex()).toBe(0xffffff);
    pictures.set(0, 'albedo', null);
    expect(basic.color.getHex()).toBe(0x112233);
  });
});

describe('colour spaces', () => {
  it('textures R13 only the albedo picture is sRGB', () => {
    const material = new MeshStandardMaterial();
    const pictures = createMaterialPictures([material], vi.fn());
    pictures.set(0, 'albedo', { id: 'a', bitmap: bitmap() });
    pictures.set(0, 'normal', { id: 'n', bitmap: bitmap() });
    expect(material.map!.colorSpace).toBe(SRGBColorSpace);
    expect(material.normalMap!.colorSpace).toBe(NoColorSpace); // data maps carry no colour space tag, as the glTF loader leaves them
  });
});

describe('replaceBitmap (normal-reauthor R12, R20)', () => {
  it('normal-reauthor R12 swaps the image of the texture a picture is shown with, in place: same texture, old bitmap closed once, new one kept open, linear and unflipped', () => {
    const { first, onChanged, pictures } = twoMaterials();
    const before = bitmap();
    pictures.set(0, 'normal', { id: 'n1', bitmap: before });
    const texture = first.normalMap as Texture;
    const version = texture.version;
    onChanged.mockClear();
    const after = bitmap();
    expect(pictures.replaceBitmap('n1', after)).toBe(true);
    expect(first.normalMap).toBe(texture);
    expect(texture.image).toBe(after);
    expect(texture.version).toBeGreaterThan(version);
    expect(texture.colorSpace).toBe(NoColorSpace);
    expect(texture.flipY).toBe(false);
    expect(before.close).toHaveBeenCalledTimes(1);
    expect(after.close).not.toHaveBeenCalled();
    expect(onChanged).toHaveBeenCalledTimes(1);
  });

  it('normal-reauthor R12 a picture no slot shows is refused and the new bitmap stays with the caller', () => {
    const { pictures, onChanged } = twoMaterials();
    const orphan = bitmap();
    expect(pictures.replaceBitmap('missing', orphan)).toBe(false);
    expect(orphan.close).not.toHaveBeenCalled();
    expect(onChanged).not.toHaveBeenCalled();
  });

  it('normal-reauthor I8 a slot that shows another picture keeps its texture, its image and its bitmap when a picture is replaced', () => {
    const { first, second, pictures } = twoMaterials();
    const mine = bitmap();
    const other = bitmap();
    pictures.set(0, 'normal', { id: 'n1', bitmap: mine });
    pictures.set(1, 'normal', { id: 'n2', bitmap: other });
    const otherTexture = second.normalMap as Texture;
    const otherVersion = otherTexture.version;
    expect(pictures.replaceBitmap('n1', bitmap())).toBe(true);
    expect(second.normalMap).toBe(otherTexture);
    expect(otherTexture.image).toBe(other);
    expect(otherTexture.version).toBe(otherVersion);
    expect(other.close).not.toHaveBeenCalled();
    expect(first.normalMap).not.toBe(otherTexture);
  });

  it('mask-bake-session R10 a replacement of another size lets go of the GPU texture so it is allocated anew, and one of the same size does not', () => {
    const { first, pictures } = twoMaterials();
    pictures.set(0, 'normal', { id: 'n1', bitmap: bitmap() });
    const disposed = vi.fn();
    (first.normalMap as Texture).addEventListener('dispose', disposed);
    pictures.replaceBitmap('n1', bitmap());
    expect(disposed).not.toHaveBeenCalled();
    pictures.replaceBitmap('n1', { width: 8, height: 8, close: vi.fn() } as unknown as ImageBitmap);
    expect(disposed).toHaveBeenCalledTimes(1);
  });

  it('normal-reauthor R12 the later release closes the replacement bitmap once and not the old one again', () => {
    const { pictures } = twoMaterials();
    const before = bitmap();
    pictures.set(0, 'normal', { id: 'n1', bitmap: before });
    const after = bitmap();
    pictures.replaceBitmap('n1', after);
    pictures.release();
    expect(after.close).toHaveBeenCalledTimes(1);
    expect(before.close).toHaveBeenCalledTimes(1);
  });
});

describe('patchRects (mask-bake-session R10)', () => {
  const fakeRenderer = (drawn: boolean) => {
    const copies: Array<{ rgba: number[]; width: number; height: number; x: number; y: number; target: Texture }> = [];
    return {
      copies,
      properties: { get: () => (drawn ? { __webglTexture: {} } : {}) },
      copyTextureToTexture: vi.fn((source: DataTexture, target: Texture, _region: unknown, at: { x: number; y: number }) => {
        copies.push({ rgba: Array.from(source.image.data as Uint8Array), width: source.image.width, height: source.image.height, x: at.x, y: at.y, target });
      }),
    };
  };
  const rect = { x0: 1, y0: 2, x1: 3, y1: 3, bytes: Uint8Array.of(7, 9) };

  it('mask-bake-session R10 each rectangle is written as grey RGBA at its place into the texture the picture uses', () => {
    const { first, pictures } = twoMaterials();
    pictures.set(0, 'rough', { id: 'p1', bitmap: bitmap() });
    const renderer = fakeRenderer(true);
    expect(pictures.patchRects('p1', 4, [rect], renderer as never)).toBe(true);
    expect(renderer.copies).toEqual([{ rgba: [7, 7, 7, 255, 9, 9, 9, 255], width: 2, height: 1, x: 1, y: 2, target: first.roughnessMap }]);
  });

  it('mask-bake-session R10 it answers false and writes nothing for an unknown picture, another size, or a texture never drawn', () => {
    const { pictures } = twoMaterials();
    pictures.set(0, 'rough', { id: 'p1', bitmap: bitmap() });
    const renderer = fakeRenderer(true);
    expect(pictures.patchRects('nope', 4, [rect], renderer as never)).toBe(false);
    expect(pictures.patchRects('p1', 8, [rect], renderer as never)).toBe(false);
    const undrawn = fakeRenderer(false);
    expect(pictures.patchRects('p1', 4, [rect], undrawn as never)).toBe(false);
    expect(renderer.copyTextureToTexture).not.toHaveBeenCalled();
    expect(undrawn.copyTextureToTexture).not.toHaveBeenCalled();
  });
});
