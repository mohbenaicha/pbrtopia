import type { Edges } from '../edges';
import type { PixelImage } from '../imageTypes';
import { classifyPixelsToPalette } from './classifyPixelsToPalette';
import { majorityFilter } from './labelCleanup';
import { toHueEntries } from './hueRange';
import { resamplePictureToSquare } from './resamplePicture';

export interface QuantisedLabels {
  labels: PixelImage; // R8, size x size, values 0 to N-1
}

/**
 * Masks R17, R18, R20, R23: resamples the picture to size x size (bilinear, any shape stretched to the square; skipped when it already is that
 * size), gives every pixel the label of the palette entry nearest in hue range (`classifyPixelsToPalette`, so a drifted colour keeps the label
 * of the colour it is closest to), and runs the 3 x 3 majority filter once, whose window wraps at the edges unless `edges` is 'clamp'
 * (material-masks-core R5; the resample always clamps its sample positions to the picture). The same inputs always give the same labels.
 */
export function quantiseToLabels(image: PixelImage, palette: ReadonlyArray<{ hex: string }>, size: number, edges: Edges = 'wrap'): QuantisedLabels {
  const square = image.width === size && image.height === size ? image : resamplePictureToSquare(image, size);
  const labels = classifyPixelsToPalette(square, palette);
  return { labels: { width: size, height: size, channels: 1, data: majorityFilter(labels, size, toHueEntries(palette).length, edges) } };
}
