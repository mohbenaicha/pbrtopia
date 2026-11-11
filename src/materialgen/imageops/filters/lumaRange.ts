import type { PixelImage } from '../gpu/pixelFormats';
import type { EditMapKind } from './editControls';

// Imageops R20: the real minimum and maximum of a map's luma, for Normalise (measured once per session on the full working copy).

export function srgbToLinear(value: number): number {
  return value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4;
}

export interface LumaRange {
  min: number;
  max: number;
}

/** BT.709 luma of every texel (albedo in linear light, as the filter chain sees it; grey and data maps from the red channel as stored). */
export function computeLumaRange(image: PixelImage, kind: EditMapKind): LumaRange {
  const decode = new Float64Array(256);
  for (let i = 0; i < 256; i += 1) decode[i] = kind === 'albedo' ? srgbToLinear(i / 255) : i / 255;
  const count = image.width * image.height;
  let min = Infinity;
  let max = -Infinity;
  for (let i = 0; i < count; i += 1) {
    const at = i * image.channels;
    const luma = image.channels === 1
      ? decode[image.data[at]!]!
      : 0.2126 * decode[image.data[at]!]! + 0.7152 * decode[image.data[at + 1]!]! + 0.0722 * decode[image.data[at + 2]!]!;
    if (luma < min) min = luma;
    if (luma > max) max = luma;
  }
  return count === 0 ? { min: 0, max: 1 } : { min, max };
}
