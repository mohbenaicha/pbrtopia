import type { PixelImage } from '../imageTypes';

/** Masks R91: how much one unit of the Colour mixin slider moves a byte per byte of grey away from the component's mean. */
export const MIX_SENSITIVITY = 0.5;

/** What the bake needs of a row's Colour mixin (masks R91): its Invert and the two amounts. */
export interface BakeMix {
  invert: boolean;
  rough: number; // 0 to 1
  metal: number; // 0 to 1
}

/** Masks R91, R96: the albedo's grey as one channel, BT.709 weights on the stored bytes (an RGB or RGBA picture; a grey one is returned as it is). One pass, N bytes. */
export function albedoToGrey(image: PixelImage): PixelImage {
  const { width, height, channels, data } = image;
  if (channels === 1) return image;
  const grey = new Uint8Array(width * height);
  for (let index = 0, from = 0; index < grey.length; index += 1, from += channels) grey[index] = Math.round(0.2126 * data[from]! + 0.7152 * data[from + 1]! + 0.0722 * data[from + 2]!);
  return { width, height, channels: 1, data: grey };
}

/** The row a label reads from: a label with no row uses the first, as the table lookup does (masks R42). */
export const rowOfLabel = (label: number, rowCount: number): number => (label < rowCount ? label : 0);

/** Masks R91: each row's grain gain for one map (0 for a row without the mixin); null when no row has any, so the map is not grained at all. */
export function grainGains(mixes: ReadonlyArray<BakeMix | undefined>, which: 'rough' | 'metal'): number[] | null {
  if (mixes.every((mix) => mix === undefined || mix[which] === 0)) return null;
  return mixes.map((mix) => (mix === undefined ? 0 : mix[which] * MIX_SENSITIVITY * (mix.invert ? -1 : 1)));
}

/** Masks R91: one baked byte after the grain of its row (`gain` from `grainGains`, the texel's grey and the row's mean grey). */
export const grainedByte = (baked: number, gain: number, grey: number, mean: number): number => Math.min(Math.max(Math.round(baked + gain * (grey - mean)), 0), 255);

/** Masks R91: the mean of the albedo grey over the pixels of each row's label, for the rows that have the mixin (the others stay 0). One pass, O(N). */
export function meanGreyPerRow(labels: PixelImage, grey: PixelImage, mixes: ReadonlyArray<BakeMix | undefined>): Float64Array {
  const sums = new Float64Array(mixes.length);
  const counts = new Float64Array(mixes.length);
  for (let index = 0; index < labels.data.length; index += 1) {
    const row = rowOfLabel(labels.data[index]!, mixes.length);
    if (mixes[row] === undefined) continue;
    sums[row] = sums[row]! + grey.data[index]!;
    counts[row] = counts[row]! + 1;
  }
  return sums.map((sum, row) => (counts[row]! > 0 ? sum / counts[row]! : 0));
}

/**
 * Masks R91: adds `amount x 0.5 x (g - mean) x sign` to each baked byte of a row that has the mixin, clamped to a byte; the grain is not blurred. `which`
 * picks the roughness or the metal amount. One pass, O(N), and a map with every amount at 0 is returned untouched.
 */
export function addGrain(baked: Uint8Array, labels: PixelImage, grey: PixelImage, mixes: ReadonlyArray<BakeMix | undefined>, means: Float64Array, which: 'rough' | 'metal'): Uint8Array {
  const gains = grainGains(mixes, which);
  if (gains === null) return baked;
  for (let index = 0; index < baked.length; index += 1) {
    const row = rowOfLabel(labels.data[index]!, mixes.length);
    const gain = gains[row]!;
    if (gain === 0) continue;
    baked[index] = grainedByte(baked[index]!, gain, grey.data[index]!, means[row]!);
  }
  return baked;
}
