import type { PixelImage } from '@mat/workerapi';
import { addGrain, meanGreyPerRow, type BakeMix } from './colourMixin';

export interface BakeRow {
  rough: number; // 0 to 1
  metal: number; // 0 to 1
  mix?: BakeMix; // present only for a row whose Colour mixin is on (R91)
}

export interface BakeInput {
  labels: PixelImage; // R8
  rows: readonly BakeRow[]; // the look-up tables: row k is label k
  feather: number; // 0 to 4 pixels
  grey?: PixelImage; // the albedo's grey at the labels' size; the Colour mixin of the rows that have it reads it (R91), without it they bake plainly
}

export const MAX_FEATHER = 4;

/** Masks R43: a table value of 0 to 1 as a byte. */
const toByte = (value: number): number => Math.round(Math.min(Math.max(value, 0), 1) * 255);

/**
 * One wrapped box blur of radius `radius` over whole numbers: sums the window in each direction and divides once at the end, so a region of
 * one value stays exactly that value (masks R44).
 */
export function blurWrapped(bytes: Uint8Array, width: number, height: number, radius: number): Uint8Array {
  const span = radius * 2 + 1;
  const across = new Uint16Array(bytes.length);
  for (let y = 0; y < height; y += 1) {
    const row = y * width;
    for (let x = 0; x < width; x += 1) {
      let sum = 0;
      for (let step = -radius; step <= radius; step += 1) sum += bytes[row + ((((x + step) % width) + width) % width)]!;
      across[row + x] = sum;
    }
  }
  const result = new Uint8Array(bytes.length);
  const area = span * span;
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      let sum = 0;
      for (let step = -radius; step <= radius; step += 1) sum += across[((((y + step) % height) + height) % height) * width + x]!;
      result[y * width + x] = Math.round(sum / area);
    }
  }
  return result;
}

/**
 * Masks R42-R44, R46: turns the labels and the two look-up tables into the `rough` and `metal` maps (R8, the labels' size). Feather 0 is the
 * table value times 255, rounded; above 0 the mapped values are blurred across label boundaries by a wrapped box of that radius. A label
 * with no row uses the first row, so a stale label never reads past the table. The result depends only on the inputs.
 */
export function bakeMasks({ labels, rows, feather, grey }: BakeInput): { rough: PixelImage; metal: PixelImage } {
  const { width, height } = labels;
  const radius = Math.min(Math.max(Math.round(feather), 0), MAX_FEATHER);
  const roughTable = rows.map((row) => toByte(row.rough));
  const metalTable = rows.map((row) => toByte(row.metal));
  const mixes = rows.map((row) => row.mix);
  const mixing = grey !== undefined && grey.data.length === labels.data.length && mixes.some((mix) => mix !== undefined);
  const means = mixing ? meanGreyPerRow(labels, grey, mixes) : null;
  const map = (table: number[], which: 'rough' | 'metal'): Uint8Array => {
    const mapped = new Uint8Array(labels.data.length);
    for (let index = 0; index < mapped.length; index += 1) mapped[index] = table[labels.data[index]!] ?? table[0] ?? 0;
    const smooth = radius === 0 ? mapped : blurWrapped(mapped, width, height, radius);
    return means === null ? smooth : addGrain(smooth, labels, grey!, mixes, means, which); // R91: after the feather, so the grain is not blurred
  };
  return {
    rough: { width, height, channels: 1, data: map(roughTable, 'rough') },
    metal: { width, height, channels: 1, data: map(metalTable, 'metal') },
  };
}
