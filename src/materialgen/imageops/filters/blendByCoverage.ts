import type { PixelImage } from '../gpu/pixelFormats';

/**
 * Imageops R79: `original + coverage x (filtered - original)` per pixel and channel, rounded. Where the coverage is 0 the result is the original
 * bytes exactly, where it is 255 the filtered ones. The three pictures have one size; the coverage has one channel. Nothing is changed in place.
 * Time O(width x height x channels), space one result picture.
 */
export function blendByCoverage(original: PixelImage, filtered: PixelImage, coverage: PixelImage): PixelImage {
  const { width, height, channels } = original;
  if (filtered.width !== width || filtered.height !== height || coverage.width !== width || coverage.height !== height) throw new Error('The pictures to blend are not the same size.');
  const data = new Uint8Array(original.data.length);
  for (let pixel = 0, index = 0; pixel < width * height; pixel += 1) {
    const share = coverage.data[pixel]!;
    for (let channel = 0; channel < channels; channel += 1, index += 1) {
      const before = original.data[index]!;
      data[index] = share === 0 ? before : share === 255 ? filtered.data[index]! : Math.round(before + ((filtered.data[index]! - before) * share) / 255);
    }
  }
  return { width, height, channels, data };
}

/**
 * Imageops R79: the picture at 1/factor of its side, each output pixel the average of a factor x factor block (what a linear resample of the graphics
 * card gives at a factor of 2). A factor of 1 returns the picture itself. Time O(width x height x channels).
 */
export function downsampleBox(image: PixelImage, factor: number): PixelImage {
  if (factor <= 1) return image;
  const { channels } = image;
  const width = Math.floor(image.width / factor);
  const height = Math.floor(image.height / factor);
  const data = new Uint8Array(width * height * channels);
  const area = factor * factor;
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      for (let channel = 0; channel < channels; channel += 1) {
        let sum = 0;
        for (let dy = 0; dy < factor; dy += 1) for (let dx = 0; dx < factor; dx += 1) sum += image.data[((y * factor + dy) * image.width + x * factor + dx) * channels + channel]!;
        data[(y * width + x) * channels + channel] = Math.round(sum / area);
      }
    }
  }
  return { width, height, channels, data };
}
