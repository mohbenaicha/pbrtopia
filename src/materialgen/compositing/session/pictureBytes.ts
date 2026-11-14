import type { PixelImage } from '@mat/maps/png/pngCodec';

// Compositing R17, R20, R22: the stored maps (interleaved grey, RGB or RGBA pictures) as the painter's byte arrays, and back. Pure.

type Bytes = Uint8Array<ArrayBuffer>;

/** Opaque RGBA bytes of any stored picture (grey is spread over RGB, a missing alpha is 255). */
export function rgbaFromImage(image: PixelImage): Bytes {
  const count = image.width * image.height;
  const out = new Uint8Array(count * 4);
  for (let index = 0; index < count; index += 1) {
    const at = index * image.channels;
    out[index * 4] = image.data[at]!;
    out[index * 4 + 1] = image.channels === 1 ? image.data[at]! : image.data[at + 1]!;
    out[index * 4 + 2] = image.channels === 1 ? image.data[at]! : image.data[at + 2]!;
    out[index * 4 + 3] = image.channels === 4 ? image.data[at + 3]! : 255;
  }
  return out;
}

/** The first channel of a stored picture: what a grey map (height, roughness, metal, AO) holds. */
export function greyFromImage(image: PixelImage): Bytes {
  const count = image.width * image.height;
  const out = new Uint8Array(count);
  for (let index = 0; index < count; index += 1) out[index] = image.data[index * image.channels]!;
  return out;
}

/** The packed texture the preview samples: R = AO (255 without one), G = roughness (128), B = metal (0), A = 255 (R20). */
export function ormFromMaps(maps: { ao?: PixelImage; rough?: PixelImage; metal?: PixelImage }, width: number, height: number): Bytes {
  const count = width * height;
  const ao = maps.ao === undefined ? null : greyFromImage(maps.ao);
  const rough = maps.rough === undefined ? null : greyFromImage(maps.rough);
  const metal = maps.metal === undefined ? null : greyFromImage(maps.metal);
  const out = new Uint8Array(count * 4);
  for (let index = 0; index < count; index += 1) {
    out[index * 4] = ao === null ? 255 : ao[index]!;
    out[index * 4 + 1] = rough === null ? 128 : rough[index]!;
    out[index * 4 + 2] = metal === null ? 0 : metal[index]!;
    out[index * 4 + 3] = 255;
  }
  return out;
}

export function imageFromGrey(bytes: Uint8Array, width: number, height: number): PixelImage {
  return { width, height, channels: 1, data: Uint8Array.from(bytes) };
}

/** The two stored maps a packed texture holds: roughness from G, metal from B (A9 step 2). */
export function splitOrm(orm: Uint8Array, width: number, height: number): { rough: PixelImage; metal: PixelImage } {
  const count = width * height;
  const rough = new Uint8Array(count);
  const metal = new Uint8Array(count);
  for (let index = 0; index < count; index += 1) { rough[index] = orm[index * 4 + 1]!; metal[index] = orm[index * 4 + 2]!; }
  return { rough: { width, height, channels: 1, data: rough }, metal: { width, height, channels: 1, data: metal } };
}

/** RGBA bytes as a stored picture of 3 or 4 channels. */
export function imageFromRgba(bytes: Uint8Array, width: number, height: number, channels: 3 | 4): PixelImage {
  if (channels === 4) return { width, height, channels, data: Uint8Array.from(bytes) };
  const count = width * height;
  const out = new Uint8Array(count * 3);
  for (let index = 0; index < count; index += 1) out.set(bytes.subarray(index * 4, index * 4 + 3), index * 3);
  return { width, height, channels, data: out };
}
