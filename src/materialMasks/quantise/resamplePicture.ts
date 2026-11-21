import type { PixelImage } from '../imageTypes';

/**
 * Masks R17: the picture stretched to size x size by bilinear sampling (any shape to the square, sample positions clamped to the picture), as
 * 3-channel colour. A grey picture is read as grey colour; alpha is dropped.
 */
export function resamplePictureToSquare(image: PixelImage, size: number): PixelImage {
  const { width, height, channels, data } = image;
  const out = new Uint8Array(size * size * 3);
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
      for (let c = 0; c < 3; c += 1) {
        const top = channel(x0, y0, c) * (1 - fx) + channel(x1, y0, c) * fx;
        const bottom = channel(x0, y1, c) * (1 - fx) + channel(x1, y1, c) * fx;
        out[(y * size + x) * 3 + c] = Math.round(top * (1 - fy) + bottom * fy);
      }
    }
  }
  return { width: size, height: size, channels: 3, data: out };
}
