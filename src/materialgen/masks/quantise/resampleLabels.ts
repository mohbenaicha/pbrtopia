import type { PixelImage } from '@mat/workerapi';

/**
 * Masks R79: label numbers (one channel) taken to `side` x `side` by nearest neighbour, so every new pixel keeps one existing label and no
 * two labels are ever blended. Labels already at that size are returned as they are.
 */
export function resampleLabelsToSide(labels: PixelImage, side: number): PixelImage {
  if (labels.width === side && labels.height === side) return labels;
  const data = new Uint8Array(side * side);
  for (let y = 0; y < side; y += 1) {
    const sourceY = Math.min(labels.height - 1, Math.floor(((y + 0.5) * labels.height) / side));
    for (let x = 0; x < side; x += 1) {
      const sourceX = Math.min(labels.width - 1, Math.floor(((x + 0.5) * labels.width) / side));
      data[y * side + x] = labels.data[sourceY * labels.width + sourceX]!;
    }
  }
  return { width: side, height: side, channels: 1, data };
}
