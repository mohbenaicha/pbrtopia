import type { PixelImage } from '../imageTypes';
import type { Rgb } from '../color/lab';
import { labelByHueRange, toHueEntries } from './hueRange';

/** The label of a pixel that belongs to no palette entry: it matched the background colour (material-masks-core R12). */
export const NONE_LABEL = 255;

export interface BackgroundKey {
  rgb: Rgb;
  /** The largest difference, in any one channel (0 to 255), at which a pixel still counts as the background. */
  tolerance: number;
}

/**
 * Material-masks-core R12: the label of every pixel by the hue-range rule (`labelByHueRange`), at the picture's own size. No resampling, no blur
 * and no cleanup, so a label depends only on its own pixel. With `background`, a pixel within the tolerance of that colour gets `NONE_LABEL`.
 * Grey pictures are read as grey colour and the alpha of an RGBA picture is ignored.
 */
export function classifyPixelsToPalette(pixels: PixelImage, palette: ReadonlyArray<{ hex: string }>, background?: BackgroundKey): Uint8Array {
  const { width, height, channels, data } = pixels;
  const entries = toHueEntries(palette);
  const labels = new Uint8Array(width * height);
  for (let index = 0; index < labels.length; index += 1) {
    const base = index * channels;
    const r = data[base]!;
    const g = data[base + (channels === 1 ? 0 : 1)]!;
    const b = data[base + (channels === 1 ? 0 : 2)]!;
    const isBackground = background !== undefined && Math.max(Math.abs(r - background.rgb[0]), Math.abs(g - background.rgb[1]), Math.abs(b - background.rgb[2])) <= background.tolerance;
    labels[index] = isBackground ? NONE_LABEL : labelByHueRange(entries, r, g, b);
  }
  return labels;
}
