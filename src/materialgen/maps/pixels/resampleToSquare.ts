import type { PixelImage } from '../png/pngCodec';

export interface ResampleOptions {
  /** A normal map: each vector is made unit length again after resampling (maps R27). */
  normal?: boolean;
  /** Labels (masks R60): each output pixel takes the one source pixel under its centre; values are never averaged. */
  nearest?: boolean;
}

function resampleNearest(image: PixelImage, side: number): PixelImage {
  const { channels, width, height } = image;
  const data = new Uint8Array(side * side * channels);
  for (let y = 0; y < side; y += 1) {
    const sourceY = Math.min(height - 1, Math.floor(((y + 0.5) * height) / side));
    for (let x = 0; x < side; x += 1) {
      const sourceX = Math.min(width - 1, Math.floor(((x + 0.5) * width) / side));
      for (let c = 0; c < channels; c += 1) data[(y * side + x) * channels + c] = image.data[(sourceY * width + sourceX) * channels + c]!;
    }
  }
  return { width: side, height: side, channels, data };
}

/** For each of `to` output positions along an axis of `from` samples: the first source index and the weights of the samples it mixes (area average when reducing, bilinear when enlarging). */
function axisWeights(from: number, to: number): { weights: Float32Array[]; starts: number[] } {
  const starts: number[] = [];
  const weights: Float32Array[] = [];
  const scale = from / to;
  for (let i = 0; i < to; i += 1) {
    if (scale > 1) {
      const lo = i * scale;
      const hi = (i + 1) * scale;
      const first = Math.floor(lo);
      const last = Math.min(from - 1, Math.ceil(hi) - 1);
      const row = new Float32Array(last - first + 1);
      for (let s = first; s <= last; s += 1) row[s - first] = (Math.min(hi, s + 1) - Math.max(lo, s)) / scale;
      starts.push(first);
      weights.push(row);
    } else {
      const at = Math.min(from - 1, Math.max(0, (i + 0.5) * scale - 0.5));
      const first = Math.floor(at);
      const fraction = at - first;
      starts.push(first);
      weights.push(first + 1 < from && fraction > 0 ? Float32Array.of(1 - fraction, fraction) : Float32Array.of(1));
    }
  }
  return { weights, starts };
}

function renormalise(data: Float32Array, count: number): void {
  for (let i = 0; i < count; i += 1) {
    const x = (data[i * 3]! / 255) * 2 - 1;
    const y = (data[i * 3 + 1]! / 255) * 2 - 1;
    const z = (data[i * 3 + 2]! / 255) * 2 - 1;
    const length = Math.hypot(x, y, z);
    const [nx, ny, nz] = length < 0.01 ? [0, 0, 1] : [x / length, y / length, z / length];
    data[i * 3] = (nx! * 0.5 + 0.5) * 255;
    data[i * 3 + 1] = (ny! * 0.5 + 0.5) * 255;
    data[i * 3 + 2] = (nz! * 0.5 + 0.5) * 255;
  }
}

/**
 * R27, R39: the image as `side` x `side` pixels, each axis by its own factor (the aspect is ignored). Reduction averages the covered area,
 * enlargement is bilinear. The one resample rule of the material generator.
 */
export function resampleToSquare(image: PixelImage, side: number, options: ResampleOptions = {}): PixelImage {
  if (image.width === side && image.height === side) return image;
  if (options.nearest === true) return resampleNearest(image, side);
  const { channels, width, height } = image;
  const across = axisWeights(width, side);
  const down = axisWeights(height, side);
  const wide = new Float32Array(side * height * channels); // resampled horizontally first
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < side; x += 1) {
      const weights = across.weights[x]!;
      const first = across.starts[x]!;
      for (let c = 0; c < channels; c += 1) {
        let sum = 0;
        for (let k = 0; k < weights.length; k += 1) sum += weights[k]! * image.data[(y * width + first + k) * channels + c]!;
        wide[(y * side + x) * channels + c] = sum;
      }
    }
  }
  const out = new Float32Array(side * side * channels);
  for (let y = 0; y < side; y += 1) {
    const weights = down.weights[y]!;
    const first = down.starts[y]!;
    for (let x = 0; x < side * channels; x += 1) {
      let sum = 0;
      for (let k = 0; k < weights.length; k += 1) sum += weights[k]! * wide[(first + k) * side * channels + x]!;
      out[y * side * channels + x] = sum;
    }
  }
  if (options.normal && channels >= 3) {
    if (channels === 3) renormalise(out, side * side);
    else throw new Error('A normal map has no alpha channel');
  }
  const data = new Uint8Array(out.length);
  for (let i = 0; i < out.length; i += 1) data[i] = Math.min(255, Math.max(0, Math.round(out[i]!)));
  return { width: side, height: side, channels, data };
}
