import { DataTexture, LinearFilter, LinearMipmapLinearFilter, NearestFilter, NoColorSpace, RGBAFormat, RepeatWrapping, SRGBColorSpace, UnsignedByteType } from 'three';
import type { PixelImage } from '@mat/workerapi';

/** The picture as RGBA bytes; a grey picture fills red, green and blue with its value. */
export function toRgbaBytes(image: PixelImage): Uint8Array {
  if (image.channels === 4) return image.data;
  const count = image.width * image.height;
  const rgba = new Uint8Array(count * 4);
  for (let i = 0; i < count; i += 1) {
    if (image.channels === 1) rgba.fill(image.data[i]!, i * 4, i * 4 + 3);
    else rgba.set(image.data.subarray(i * 3, i * 3 + 3), i * 4);
    rgba[i * 4 + 3] = 255;
  }
  return rgba;
}

/** Preview R8: a texture that repeats and uses mipmaps; the albedo is read as sRGB, everything else as plain numbers. */
export function createPixelTexture(rgba: Uint8Array, width: number, height: number, colorSpace: typeof SRGBColorSpace | typeof NoColorSpace, exact = false): DataTexture {
  const texture = new DataTexture(rgba as Uint8Array<ArrayBuffer>, width, height, RGBAFormat, UnsignedByteType);
  texture.colorSpace = colorSpace;
  texture.wrapS = RepeatWrapping;
  texture.wrapT = RepeatWrapping;
  texture.generateMipmaps = !exact; // `exact`: label ids, which must never be blended
  texture.minFilter = exact ? NearestFilter : LinearMipmapLinearFilter;
  texture.magFilter = exact ? NearestFilter : LinearFilter;
  texture.anisotropy = exact ? 1 : 8;
  texture.flipY = true; // the first row of a picture is its top, which is v = 1 on the preview meshes
  texture.needsUpdate = true;
  return texture;
}
