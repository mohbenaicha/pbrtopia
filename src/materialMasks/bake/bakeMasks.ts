import type { Edges } from '../edges';
import { NONE_LABEL } from '../quantise/classifyPixelsToPalette';
import type { PixelImage } from '../imageTypes';
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
  edges?: Edges; // what the feather blur sees beyond the border (material-masks-core R5); 'wrap' when omitted
  base?: { rough: PixelImage; metal: PixelImage }; // mask-mode R14: the maps as they are now. With it a texel with no mask (NONE_LABEL) or a `keep` texel keeps the base pixel, and the feather blends only masked texels
  keep?: Uint8Array; // with `base`: 1 = a texel that keeps its base pixel whatever its label (under a hidden triangle)
  means?: Float64Array; // mask-bake-session R7: the mean grey of each row over the whole picture, when the caller bakes a crop of it (the grain is relative to the row's mean over all its texels); omitted: computed from `labels` and `grey`
}

export const MAX_FEATHER = 4;

/** Masks R43: a table value of 0 to 1 as a byte. */
export const toByte = (value: number): number => Math.round(Math.min(Math.max(value, 0), 1) * 255);

/**
 * One box blur of radius `radius` over whole numbers: sums the window in each direction and divides once at the end, so a region of one value
 * stays exactly that value (masks R44). The window wraps at the picture's edges, or with `edges: 'clamp'` repeats the border pixel
 * (material-masks-core R5).
 */
export function blurBox(bytes: Uint8Array, width: number, height: number, radius: number, edges: Edges = 'wrap'): Uint8Array {
  const span = radius * 2 + 1;
  const reach = edges === 'wrap'
    ? (position: number, length: number): number => ((position % length) + length) % length
    : (position: number, length: number): number => Math.min(Math.max(position, 0), length - 1);
  const across = new Uint16Array(bytes.length);
  for (let y = 0; y < height; y += 1) {
    const row = y * width;
    for (let x = 0; x < width; x += 1) {
      let sum = 0;
      for (let step = -radius; step <= radius; step += 1) sum += bytes[row + reach(x + step, width)]!;
      across[row + x] = sum;
    }
  }
  const result = new Uint8Array(bytes.length);
  const area = span * span;
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      let sum = 0;
      for (let step = -radius; step <= radius; step += 1) sum += across[reach(y + step, height) * width + x]!;
      result[y * width + x] = Math.round(sum / area);
    }
  }
  return result;
}

/**
 * Mask-mode R14, mask-bake-session R8: the box blur over the masked texels only (weights 1 where `masked` is 1, else 0), normalised by the masked weight in the window.
 * A masked region of one value stays exactly that value; an unmasked texel is not computed (0). Separable: one pass across sums the masked values and the masked
 * count of each row window, one pass down sums those; the totals are the same whole numbers the (2r+1)^2 window gave, so the bytes are the same. At radius 4 a window sum
 * is at most 81 x 255 = 20655, which fits 16 bits.
 */
export function blurMasked(bytes: Uint8Array, masked: Uint8Array, width: number, height: number, radius: number, edges: Edges): Uint8Array {
  const reach = edges === 'wrap'
    ? (position: number, length: number): number => ((position % length) + length) % length
    : (position: number, length: number): number => Math.min(Math.max(position, 0), length - 1);
  const rowSums = new Uint16Array(bytes.length);
  const rowCounts = new Uint16Array(bytes.length);
  for (let y = 0; y < height; y += 1) {
    const row = y * width;
    for (let x = 0; x < width; x += 1) {
      let sum = 0;
      let count = 0;
      for (let step = -radius; step <= radius; step += 1) {
        const at = row + reach(x + step, width);
        if (masked[at] === 1) {
          sum += bytes[at]!;
          count += 1;
        }
      }
      rowSums[row + x] = sum;
      rowCounts[row + x] = count;
    }
  }
  const result = new Uint8Array(bytes.length);
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      if (masked[y * width + x] !== 1) continue;
      let sum = 0;
      let weight = 0;
      for (let step = -radius; step <= radius; step += 1) {
        const at = reach(y + step, height) * width + x;
        sum += rowSums[at]!;
        weight += rowCounts[at]!;
      }
      result[y * width + x] = Math.round(sum / weight);
    }
  }
  return result;
}

/**
 * Masks R42-R44, R46: turns the labels and the two look-up tables into the `rough` and `metal` maps (R8, the labels' size). Feather 0 is the
 * table value times 255, rounded; above 0 the mapped values are blurred across label boundaries by a box of that radius (wrapped, or clamped by `edges`). A label
 * with no row uses the first row, so a stale label never reads past the table. The result depends only on the inputs.
 */
export function bakeMasks(input: BakeInput): { rough: PixelImage; metal: PixelImage } {
  const { rough, metal } = bakeNamedMasks(input, ['rough', 'metal']);
  return { rough: rough!, metal: metal! };
}

/** Mask-bake-session R4: the same bake as `bakeMasks`, for the named maps only; each named map's bytes equal that map of the full bake. */
export function bakeNamedMasks({ labels, rows, feather, grey, edges = 'wrap', base, keep, means: knownMeans }: BakeInput, named: readonly ('rough' | 'metal')[]): { rough?: PixelImage; metal?: PixelImage } {
  const { width, height } = labels;
  const masked = base === undefined ? null : labels.data.map((label, index) => (label === NONE_LABEL || keep?.[index] === 1 ? 0 : 1));
  const radius = Math.min(Math.max(Math.round(feather), 0), MAX_FEATHER);
  const roughTable = rows.map((row) => toByte(row.rough));
  const metalTable = rows.map((row) => toByte(row.metal));
  const mixes = rows.map((row) => row.mix);
  const mixing = grey !== undefined && grey.data.length === labels.data.length && mixes.some((mix) => mix !== undefined);
  const means = mixing ? (knownMeans ?? meanGreyPerRow(labels, grey, mixes)) : null;
  const map = (table: number[], which: 'rough' | 'metal'): Uint8Array => {
    const mapped = new Uint8Array(labels.data.length);
    for (let index = 0; index < mapped.length; index += 1) mapped[index] = table[labels.data[index]!] ?? table[0] ?? 0;
    const smooth = radius === 0 ? mapped : masked === null ? blurBox(mapped, width, height, radius, edges) : blurMasked(mapped, masked, width, height, radius, edges);
    const grained = means === null ? smooth : addGrain(smooth, labels, grey!, mixes, means, which); // R91: after the feather, so the grain is not blurred
    if (masked === null || base === undefined) return grained;
    const baseBytes = base[which].data;
    return grained.map((value, index) => (masked[index] === 1 ? value : baseBytes[index]!)); // R14: a texel with no mask keeps the base pixel
  };
  return {
    ...(named.includes('rough') ? { rough: { width, height, channels: 1 as const, data: map(roughTable, 'rough') } } : {}),
    ...(named.includes('metal') ? { metal: { width, height, channels: 1 as const, data: map(metalTable, 'metal') } } : {}),
  };
}
