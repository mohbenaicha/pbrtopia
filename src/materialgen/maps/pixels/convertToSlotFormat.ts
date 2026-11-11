import type { MapKind } from '../mapKinds';
import type { PixelImage } from '../png/pngCodec';

/** What a slot stores: Color and Normal are RGB, the other maps greyscale (maps R3). */
export type SlotPixelFormat = 'rgb' | 'grey';

const RGB_KINDS: readonly MapKind[] = ['albedo', 'diffuse', 'normal'];

/** R3: the pixel format a map of this kind is stored in; the decomposition's indexed labels are handled by the masks wave. */
export function pixelFormatOfKind(kind: MapKind): SlotPixelFormat {
  return RGB_KINDS.includes(kind) ? 'rgb' : 'grey';
}

const LUMA = [0.2126, 0.7152, 0.0722] as const;

/**
 * R35: converts a decoded image to the slot's format. Alpha is dropped as stored, not multiplied in; grey expands to RGB; colour becomes
 * luminance (weights 0.2126, 0.7152, 0.0722 on the stored values). An image already in the format is returned as it is.
 */
export function convertToSlotFormat(image: PixelImage, format: SlotPixelFormat): PixelImage {
  const wanted = format === 'grey' ? 1 : 3;
  if (image.channels === wanted) return image;
  const count = image.width * image.height;
  const data = new Uint8Array(count * wanted);
  const source = image.data;
  const step = image.channels;
  // Plain index loops: a subarray or fill call per pixel allocates millions of objects on a large picture.
  if (step === 1) {
    for (let i = 0, o = 0; i < count; i += 1, o += 3) {
      const value = source[i]!;
      data[o] = value;
      data[o + 1] = value;
      data[o + 2] = value;
    }
  } else if (wanted === 3) {
    for (let i = 0, from = 0, o = 0; i < count; i += 1, from += step, o += 3) {
      data[o] = source[from]!;
      data[o + 1] = source[from + 1]!;
      data[o + 2] = source[from + 2]!;
    }
  } else {
    for (let i = 0, from = 0; i < count; i += 1, from += step) {
      data[i] = Math.round(source[from]! * LUMA[0] + source[from + 1]! * LUMA[1] + source[from + 2]! * LUMA[2]);
    }
  }
  return { width: image.width, height: image.height, channels: wanted, data };
}
