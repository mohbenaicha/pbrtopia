import type { PixelImage } from '@mat/workerapi';

/**
 * Export R46: the picture repeated `across` times along the width and `down` times along the height, as exact copies of its pixels. 1 x 1 returns the
 * picture itself; otherwise a new picture is made and the source is never changed. Time O(output pixels), space one output picture.
 */
export function tileExportPicture(image: PixelImage, across: number, down: number): PixelImage {
  if (across === 1 && down === 1) return image;
  const { width, height, channels } = image;
  const rowBytes = width * channels;
  const outRowBytes = rowBytes * across;
  const data = new Uint8Array(outRowBytes * height * down);
  for (let y = 0; y < height; y += 1) {
    const source = image.data.subarray(y * rowBytes, (y + 1) * rowBytes);
    for (let repeat = 0; repeat < across; repeat += 1) data.set(source, y * outRowBytes + repeat * rowBytes);
    const first = data.subarray(y * outRowBytes, (y + 1) * outRowBytes);
    for (let repeat = 1; repeat < down; repeat += 1) data.set(first, (repeat * height + y) * outRowBytes);
  }
  return { width: width * across, height: height * down, channels, data };
}
