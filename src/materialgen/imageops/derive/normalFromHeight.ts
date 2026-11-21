import type { EditValues } from '../filters/editControls';
import type { PixelImage } from '../gpu/pixelFormats';

// Normal-from-height R5: the normal map of a height map, as a tiling texture (every neighbour wraps at the picture's edges).

const SLOPE_FLOOR = 0.01;
const TARGET_PERCENTILE = 0.95;

const ROUNDING_NOISE = 1e-6; // a blurred flat map differs from itself by float rounding; far below one grey level (0.0039)

const wrap = (index: number, side: number): number => ((index % side) + side) % side;
const withoutRoundingNoise = (slope: number): number => (Math.abs(slope) < ROUNDING_NOISE ? 0 : slope);

function readHeight(image: PixelImage): Float32Array {
  const count = image.width * image.height;
  const out = new Float32Array(count);
  for (let i = 0, from = 0; i < count; i += 1, from += image.channels) out[i] = image.data[from]! / 255;
  return out;
}

function buildGaussianKernel(sigma: number): Float32Array {
  const radius = Math.max(1, Math.ceil(sigma * 3));
  const kernel = new Float32Array(radius * 2 + 1);
  let sum = 0;
  for (let i = -radius; i <= radius; i += 1) {
    const weight = Math.exp(-(i * i) / (2 * sigma * sigma));
    kernel[i + radius] = weight;
    sum += weight;
  }
  for (let i = 0; i < kernel.length; i += 1) kernel[i] = kernel[i]! / sum;
  return kernel;
}

function blurWrapped(values: Float32Array, side: number, sigma: number): Float32Array {
  const kernel = buildGaussianKernel(sigma);
  const radius = (kernel.length - 1) / 2;
  const across = new Float32Array(values.length);
  const result = new Float32Array(values.length);
  for (let y = 0; y < side; y += 1) {
    for (let x = 0; x < side; x += 1) {
      let sum = 0;
      for (let k = -radius; k <= radius; k += 1) sum += kernel[k + radius]! * values[y * side + wrap(x + k, side)]!;
      across[y * side + x] = sum;
    }
  }
  for (let y = 0; y < side; y += 1) {
    for (let x = 0; x < side; x += 1) {
      let sum = 0;
      for (let k = -radius; k <= radius; k += 1) sum += kernel[k + radius]! * across[wrap(y + k, side) * side + x]!;
      result[y * side + x] = sum;
    }
  }
  return result;
}

/**
 * The OpenGL normal map (3 channels, +Y up) of the picture's red channel. Blur is a Gaussian of `blur * S / 1024` px; the slopes are central differences (y runs
 * down the picture); the gain makes the 95th percentile slope tilt `strength` degrees, with a floor so a nearly flat map is not blown up.
 */
export function computeNormalFromHeight(height: PixelImage, values: EditValues): PixelImage {
  const side = height.width;
  const count = side * side;
  const blur = values['blur'] ?? 1;
  const strength = values['strength'] ?? 45;
  const raw = readHeight(height);
  const smooth = blur > 0 ? blurWrapped(raw, side, (blur * side) / 1024) : raw;

  const slopeX = new Float32Array(count);
  const slopeY = new Float32Array(count);
  const magnitudes = new Float32Array(count);
  for (let y = 0; y < side; y += 1) {
    const above = wrap(y - 1, side) * side;
    const below = wrap(y + 1, side) * side;
    for (let x = 0; x < side; x += 1) {
      const i = y * side + x;
      slopeX[i] = withoutRoundingNoise((smooth[y * side + wrap(x + 1, side)]! - smooth[y * side + wrap(x - 1, side)]!) / 2);
      slopeY[i] = withoutRoundingNoise((smooth[below + x]! - smooth[above + x]!) / 2);
      magnitudes[i] = Math.hypot(slopeX[i]!, slopeY[i]!);
    }
  }
  const p95 = magnitudes.sort()[Math.min(count - 1, Math.floor(TARGET_PERCENTILE * count))]!;
  const gain = Math.tan((strength * Math.PI) / 180) / Math.max(p95, SLOPE_FLOOR);

  const data = new Uint8Array(count * 3);
  for (let i = 0; i < count; i += 1) {
    const nx = -slopeX[i]! * gain;
    const ny = slopeY[i]! * gain;
    const inverse = 1 / Math.sqrt(nx * nx + ny * ny + 1);
    data[i * 3] = Math.round((nx * inverse * 0.5 + 0.5) * 255);
    data[i * 3 + 1] = Math.round((ny * inverse * 0.5 + 0.5) * 255);
    data[i * 3 + 2] = Math.round((inverse * 0.5 + 0.5) * 255);
  }
  return { width: side, height: side, channels: 3, data };
}
