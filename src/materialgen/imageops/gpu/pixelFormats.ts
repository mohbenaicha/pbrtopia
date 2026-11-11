// Imageops R5: the GPU works on RGBA bytes; a grey map is stored from, and written back as, its red channel.

/** Decoded pixels: the shape maps' `PixelImage` has (imageops does not import maps, whose dependency on imageops is one way). */
export interface PixelImage {
  width: number;
  height: number;
  channels: 1 | 3 | 4;
  data: Uint8Array;
}

/** The image as RGBA bytes (an RGBA image is returned as it is). */
export function toRgba(image: PixelImage): Uint8Array {
  if (image.channels === 4) return image.data;
  const count = image.width * image.height;
  const rgba = new Uint8Array(count * 4);
  const source = image.data;
  // Plain index loops: a subarray or fill call per pixel allocates millions of objects on a large picture.
  if (image.channels === 1) {
    for (let i = 0, o = 0; i < count; i += 1, o += 4) {
      const value = source[i]!;
      rgba[o] = value;
      rgba[o + 1] = value;
      rgba[o + 2] = value;
      rgba[o + 3] = 255;
    }
  } else {
    for (let i = 0, from = 0, o = 0; i < count; i += 1, from += 3, o += 4) {
      rgba[o] = source[from]!;
      rgba[o + 1] = source[from + 1]!;
      rgba[o + 2] = source[from + 2]!;
      rgba[o + 3] = 255;
    }
  }
  return rgba;
}

/** RGBA bytes as a stored map: 1 channel keeps red, 3 keeps red, green and blue. */
export function fromRgba(rgba: Uint8Array, width: number, height: number, channels: 1 | 3): PixelImage {
  const count = width * height;
  const data = new Uint8Array(count * channels);
  if (channels === 1) {
    for (let i = 0, from = 0; i < count; i += 1, from += 4) data[i] = rgba[from]!;
  } else {
    for (let i = 0, from = 0, o = 0; i < count; i += 1, from += 4, o += 3) {
      data[o] = rgba[from]!;
      data[o + 1] = rgba[from + 1]!;
      data[o + 2] = rgba[from + 2]!;
    }
  }
  return { width, height, channels, data };
}
