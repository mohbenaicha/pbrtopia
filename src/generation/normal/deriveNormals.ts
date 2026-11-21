import { fillFlatNormal, NORMAL_TARGET_TILT_DEG, SLOPE_FLOOR, SMOOTHING_SIGMA_PER_SIDE, type PixelPicture, type UprightSheet } from './uprightTypes';

// Rec. 709 luma: a colour answer is read as its brightness.
function readLuminance(picture: PixelPicture): Float32Array {
  const count = picture.side * picture.side;
  const out = new Float32Array(count);
  for (let i = 0; i < count; i += 1) {
    out[i] = (0.2126 * picture.rgba[i * 4]! + 0.7152 * picture.rgba[i * 4 + 1]! + 0.0722 * picture.rgba[i * 4 + 2]!) / 255;
  }
  return out;
}

function gaussianKernel(sigma: number): Float32Array {
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

// Separable Gaussian blur, edges clamped.
function blur(values: Float32Array, side: number, sigma: number): Float32Array {
  const kernel = gaussianKernel(sigma);
  const radius = (kernel.length - 1) / 2;
  const across = new Float32Array(values.length);
  const result = new Float32Array(values.length);
  for (let y = 0; y < side; y += 1) {
    for (let x = 0; x < side; x += 1) {
      let sum = 0;
      for (let k = -radius; k <= radius; k += 1) sum += kernel[k + radius]! * values[y * side + Math.min(side - 1, Math.max(0, x + k))]!;
      across[y * side + x] = sum;
    }
  }
  for (let y = 0; y < side; y += 1) {
    for (let x = 0; x < side; x += 1) {
      let sum = 0;
      for (let k = -radius; k <= radius; k += 1) sum += kernel[k + radius]! * across[Math.min(side - 1, Math.max(0, y + k)) * side + x]!;
      result[y * side + x] = sum;
    }
  }
  return result;
}

/**
 * normal-map R18: a height map of the upright sheet (any colour, read as luminance, already at the sheet's side) to tangent-space normals on the sheet.
 * Slopes are central differences taken only inside the pieces (a neighbour outside counts as equal to the texel, so a piece's border is no cliff); the gain makes the
 * 95th percentile slope tilt NORMAL_TARGET_TILT_DEG. Texels outside every piece are flat (128, 128, 255). OpenGL convention: +Y up the picture.
 */
export function deriveNormals(height: PixelPicture, sheet: UprightSheet): PixelPicture {
  const { side } = sheet.picture;
  const mask = sheet.mask;
  const smooth = blur(readLuminance(height), side, side * SMOOTHING_SIGMA_PER_SIDE);
  const reach = (x: number, y: number, centre: number): number => (x < 0 || y < 0 || x >= side || y >= side || mask[y * side + x] === 0 ? centre : smooth[y * side + x]!);

  const slopeX = new Float32Array(side * side);
  const slopeY = new Float32Array(side * side); // y runs down the picture
  const magnitudes = new Float32Array(side * side); // the first `counted` entries hold the slope sizes of the piece texels
  let counted = 0;
  for (let y = 0; y < side; y += 1) {
    for (let x = 0; x < side; x += 1) {
      const i = y * side + x;
      if (mask[i] === 0) continue;
      const centre = smooth[i]!;
      slopeX[i] = (reach(x + 1, y, centre) - reach(x - 1, y, centre)) / 2;
      slopeY[i] = (reach(x, y + 1, centre) - reach(x, y - 1, centre)) / 2;
      magnitudes[counted] = Math.hypot(slopeX[i]!, slopeY[i]!);
      counted += 1;
    }
  }

  const rgba = new Uint8ClampedArray(side * side * 4);
  fillFlatNormal(rgba);
  if (counted === 0) return { side, rgba };
  const sorted = magnitudes.subarray(0, counted).sort();
  const p95 = sorted[Math.min(sorted.length - 1, Math.floor(sorted.length * 0.95))]!;
  const gain = Math.tan((NORMAL_TARGET_TILT_DEG * Math.PI) / 180) / Math.max(p95, SLOPE_FLOOR);
  for (let i = 0; i < side * side; i += 1) {
    if (mask[i] === 0) continue;
    const nx = -slopeX[i]! * gain;
    const ny = slopeY[i]! * gain; // dh/dy taken down the picture is +Y up for the normal
    const length = Math.hypot(nx, ny, 1);
    rgba[i * 4] = ((nx / length) * 0.5 + 0.5) * 255;
    rgba[i * 4 + 1] = ((ny / length) * 0.5 + 0.5) * 255;
    rgba[i * 4 + 2] = ((1 / length) * 0.5 + 0.5) * 255;
  }
  return { side, rgba };
}
