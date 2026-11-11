import type { PixelImage } from '@mat/workerapi';
import { MAX_FEATHER, blurWrapped } from './bakeMasks';

export interface HeightBakeInput {
  labels: PixelImage; // R8
  offsets: readonly number[]; // -1 to +1; entry k is label k
  feather: number; // 0 to 4 pixels
  base: PixelImage; // the Height map before any offset (masks R83), the labels' size
}

/** Masks R82: the whole offset range (+1) as a share of the byte range; the one number the user will tune. */
export const HEIGHT_SENSITIVITY = 0.25;

const MAX_DELTA = Math.round(HEIGHT_SENSITIVITY * 255); // the largest offset in bytes, so a blurred map fits a byte once shifted by it

/**
 * Masks R82, R44, R46: each base pixel plus its label's offset, clamped to a byte. The feather blurs the offsets across label boundaries (a
 * region far from every boundary keeps the exact offset, and the base's own detail stays), not the result. A label with no offset uses the first.
 */
export function bakeHeight({ labels, offsets, feather, base }: HeightBakeInput): PixelImage {
  const { width, height } = labels;
  const radius = Math.min(Math.max(Math.round(feather), 0), MAX_FEATHER);
  const table = offsets.map((offset) => Math.round(Math.min(Math.max(offset, -1), 1) * MAX_DELTA) + MAX_DELTA); // shifted to 0..2 x MAX_DELTA so it is a byte
  const mapped = new Uint8Array(labels.data.length);
  for (let index = 0; index < mapped.length; index += 1) mapped[index] = table[labels.data[index]!] ?? table[0] ?? MAX_DELTA;
  const smooth = radius === 0 ? mapped : blurWrapped(mapped, width, height, radius);
  const data = new Uint8Array(mapped.length);
  for (let index = 0; index < data.length; index += 1) data[index] = Math.min(Math.max((base.data[index] ?? 0) + smooth[index]! - MAX_DELTA, 0), 255);
  return { width, height, channels: 1, data };
}
