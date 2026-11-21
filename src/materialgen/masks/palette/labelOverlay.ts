import type { PixelImage } from '@shared/materialMasks';

const STRENGTH = 0.75; // masks R80: the highlight's strength
const GREY: [number, number, number] = [128, 128, 128];

const parseHex = (hex: string): [number, number, number] => {
  const match = /^#([0-9a-fA-F]{2})([0-9a-fA-F]{2})([0-9a-fA-F]{2})$/.exec(hex);
  return match === null ? GREY : [parseInt(match[1]!, 16), parseInt(match[2]!, 16), parseInt(match[3]!, 16)];
};

/**
 * Export R39: an RGBA picture of the coverage's size, every pixel `hex` with alpha = coverage x 0.75 and transparent where the coverage is 0, for the
 * emissive dialog's overlay (the soft edge of Softness shows as a soft alpha). Time O(width x height), space one RGBA picture.
 */
export function paintCoverageOverlay(coverage: PixelImage, hex: string): Uint8ClampedArray {
  const [red, green, blue] = parseHex(hex);
  const rgba = new Uint8ClampedArray(coverage.width * coverage.height * 4);
  for (let pixel = 0; pixel < coverage.data.length; pixel += 1) {
    const share = coverage.data[pixel]!;
    if (share === 0) continue;
    rgba[pixel * 4] = red;
    rgba[pixel * 4 + 1] = green;
    rgba[pixel * 4 + 2] = blue;
    rgba[pixel * 4 + 3] = Math.round(share * STRENGTH);
  }
  return rgba;
}

/**
 * Imageops R80: an RGBA picture of the labels' size with the pixels of `label` in `hex` at 0.75 strength and every other pixel transparent, for the
 * hover overlay of the filter dialog. Time O(width x height), space one RGBA picture; built again on each hover change, never kept.
 */
export function paintLabelOverlay(labels: PixelImage, label: number, hex: string): Uint8ClampedArray {
  const [red, green, blue] = parseHex(hex);
  const alpha = Math.round(STRENGTH * 255);
  const rgba = new Uint8ClampedArray(labels.width * labels.height * 4);
  for (let pixel = 0; pixel < labels.data.length; pixel += 1) {
    if (labels.data[pixel] !== label) continue;
    rgba[pixel * 4] = red;
    rgba[pixel * 4 + 1] = green;
    rgba[pixel * 4 + 2] = blue;
    rgba[pixel * 4 + 3] = alpha;
  }
  return rgba;
}
