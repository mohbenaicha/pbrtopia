// @vitest-environment jsdom
import { MeshBasicMaterial, MeshStandardMaterial, Texture } from 'three';
import { describe, expect, it } from 'vitest';
import { swapInPlaceholders } from '../../src/viewport/placeholderImages';
import type { SourceImage } from '../../src/viewport/sourceImages';
import { rememberSourceImage, sourceImageIndexOf } from '../../src/viewport/sourceImageTags';

const bigImage = (): { width: number; height: number } => ({ width: 4096, height: 4096 });
const picture = (mimeType: SourceImage['mimeType'] = 'image/png'): SourceImage => ({ mimeType, bytes: Uint8Array.from([1, 2, 3]) });

function taggedTexture(index: number | null, mimeType = 'image/png'): Texture {
  const texture = new Texture(bigImage() as unknown as HTMLImageElement);
  texture.userData['mimeType'] = mimeType;
  if (index !== null) rememberSourceImage(texture, index);
  return texture;
}

describe('rememberSourceImage (mesh edit R25)', () => {
  it('mesh edit R25 a texture and its clones answer with the same image index, a texture never tagged answers undefined', () => {
    const texture = taggedTexture(3);
    expect(sourceImageIndexOf(texture)).toBe(3);
    expect(sourceImageIndexOf(texture.clone())).toBe(3);
    expect(sourceImageIndexOf(taggedTexture(null))).toBeUndefined();
  });
});

describe('swapInPlaceholders (mesh edit R25)', () => {
  it('mesh edit R25 gives a texture that has its original a small stand-in, with the original type, and restore puts everything back', () => {
    const texture = taggedTexture(0, 'image/png');
    const before = texture.image;
    const material = new MeshStandardMaterial({ map: texture });
    const swap = swapInPlaceholders([material], new Map([[0, picture('image/jpeg')]]))!;
    expect(swap).not.toBeNull();
    expect(swap.count).toBe(1);
    expect((texture.image as HTMLCanvasElement).width).toBe(1);
    expect(texture.userData['mimeType']).toBe('image/jpeg');
    expect(swap.imageIndexOf(texture)).toBe(0);
    swap.restore();
    expect(texture.image).toBe(before);
    expect(texture.userData['mimeType']).toBe('image/png');
    expect(swap.imageIndexOf(texture)).toBeUndefined();
  });

  it('mesh edit R25 textures that share an image share one stand-in, and different images get different ones', () => {
    const base = taggedTexture(0);
    const clone = base.clone();
    const other = taggedTexture(1);
    const material = new MeshStandardMaterial({ map: base, normalMap: other, emissiveMap: clone });
    const swap = swapInPlaceholders([material], new Map([[0, picture()], [1, picture()]]))!;
    expect(clone.image).toBe(base.image);
    expect(other.image).not.toBe(base.image);
    expect(swap.imageIndexOf(clone)).toBe(0);
    expect(swap.imageIndexOf(other)).toBe(1);
    swap.restore();
    expect((base.image as { width: number }).width).toBe(4096);
    expect((clone.image as { width: number }).width).toBe(4096);
  });

  it('mesh edit R25 leaves alone a texture that was not tagged and one whose image the file did not give', () => {
    const untagged = taggedTexture(null);
    const missing = taggedTexture(7);
    const kept = taggedTexture(0);
    const swap = swapInPlaceholders([new MeshStandardMaterial({ map: untagged, normalMap: missing, emissiveMap: kept })], new Map([[0, picture()]]))!;
    expect((untagged.image as { width: number }).width).toBe(4096);
    expect((missing.image as { width: number }).width).toBe(4096);
    expect((kept.image as { width: number }).width).toBe(1);
    expect(swap.count).toBe(1);
    swap.restore();
  });

  it('mesh edit R25 gives nothing when no texture can be swapped', () => {
    expect(swapInPlaceholders([new MeshStandardMaterial()], new Map([[0, picture()]]))).toBeNull();
    expect(swapInPlaceholders([new MeshBasicMaterial({ map: taggedTexture(null) })], new Map([[0, picture()]]))).toBeNull();
    expect(swapInPlaceholders([new MeshStandardMaterial({ map: taggedTexture(0) })], new Map())).toBeNull();
  });

  it('mesh edit R25 gives nothing, and changes nothing, when a metalness and a roughness map differ: the exporter would draw them into a new picture', () => {
    const metal = taggedTexture(0);
    const rough = taggedTexture(0).clone();
    const material = new MeshStandardMaterial({ metalnessMap: metal, roughnessMap: rough });
    expect(swapInPlaceholders([material], new Map([[0, picture()]]))).toBeNull();
    expect((metal.image as { width: number }).width).toBe(4096);
  });

  it('mesh edit R25 one texture used as both the metalness and roughness map is fine', () => {
    const packed = taggedTexture(0);
    const swap = swapInPlaceholders([new MeshStandardMaterial({ metalnessMap: packed, roughnessMap: packed })], new Map([[0, picture()]]));
    expect(swap).not.toBeNull();
    swap!.restore();
  });
});
