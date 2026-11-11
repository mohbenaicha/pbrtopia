import type { PixelImage } from '@mat/workerapi';
import { labelByHueRange, toHueEntries } from './hueRange';
import { majorityFilter } from './labelCleanup';

export interface QuantisedLabels {
  labels: PixelImage; // R8, size x size, values 0 to N-1
}

/**
 * Masks R17, R18, R20, R23: resamples the picture to size x size (bilinear, any shape stretched to the square), gives every pixel the label of
 * the palette entry nearest in hue range (so a drifted colour keeps the label of the colour it is closest to), and runs the 3 x 3 majority
 * filter once. The filter wraps at the edges, and the same inputs always give the same labels.
 */
export function quantiseToLabels(image: PixelImage, palette: ReadonlyArray<{ hex: string }>, size: number): QuantisedLabels {
  const entries = toHueEntries(palette);
  const { width, height, channels, data } = image;
  const labels = new Uint8Array(size * size);
  const channel = (x: number, y: number, c: number): number => data[(y * width + x) * channels + (channels === 1 ? 0 : c)]!;
  for (let y = 0; y < size; y += 1) {
    const sy = Math.min(Math.max(((y + 0.5) * height) / size - 0.5, 0), height - 1);
    const y0 = Math.floor(sy);
    const y1 = Math.min(y0 + 1, height - 1);
    const fy = sy - y0;
    for (let x = 0; x < size; x += 1) {
      const sx = Math.min(Math.max(((x + 0.5) * width) / size - 0.5, 0), width - 1);
      const x0 = Math.floor(sx);
      const x1 = Math.min(x0 + 1, width - 1);
      const fx = sx - x0;
      const sample = (c: number): number => {
        const top = channel(x0, y0, c) * (1 - fx) + channel(x1, y0, c) * fx;
        const bottom = channel(x0, y1, c) * (1 - fx) + channel(x1, y1, c) * fx;
        return Math.round(top * (1 - fy) + bottom * fy);
      };
      labels[y * size + x] = labelByHueRange(entries, sample(0), sample(1), sample(2));
    }
  }
  return { labels: { width: size, height: size, channels: 1, data: majorityFilter(labels, size, entries.length) } };
}
