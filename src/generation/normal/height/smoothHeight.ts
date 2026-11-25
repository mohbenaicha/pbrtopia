import { SMOOTHING_SIGMA_PER_SIDE, type PixelPicture } from '../uprightTypes';
import type { SmoothedHeight } from './heightTypes';
import { computePercentile95Slope, computeUnitSlopes } from './slopesFromHeight';

function gaussianKernel(sigma: number): Float32Array {
  const radius = Math.max(1, Math.ceil(sigma * 3));
  const kernel = new Float32Array(radius * 2 + 1);
  for (let i = -radius; i <= radius; i += 1) kernel[i + radius] = Math.exp(-(i * i) / (2 * sigma * sigma));
  return kernel; // not normalised: the weights are renormalised over the texels that count
}

/** One separable pass of a normalised Gaussian over the texels of the same island only; texels of no island stay 0. */
function blurAlong(values: Float32Array, owner: Uint16Array, side: number, kernel: Float32Array, alongX: boolean): Float32Array {
  const radius = (kernel.length - 1) / 2;
  const out = new Float32Array(values.length);
  const stepOf = alongX ? 1 : side;
  for (let y = 0; y < side; y += 1) {
    for (let x = 0; x < side; x += 1) {
      const at = y * side + x;
      const mine = owner[at]!;
      if (mine === 0) continue;
      const position = alongX ? x : y;
      const low = Math.max(-radius, -position);
      const high = Math.min(radius, side - 1 - position);
      let sum = 0;
      let weights = 0;
      for (let k = low; k <= high; k += 1) {
        const other = at + k * stepOf;
        if (owner[other] !== mine) continue;
        const weight = kernel[k + radius]!;
        sum += weight * values[other]!;
        weights += weight;
      }
      out[at] = sum / weights; // the texel itself always counts, so weights > 0
    }
  }
  return out;
}

/**
 * normal-height-edit R3, R6: the base height (grey picture, level = R / 255) blurred by a Gaussian of sigma side / 1100 texels over the texels of the same island, and the
 * 95th percentile slope of the result. Done once per load; the sliders never change it.
 */
export function smoothHeight(base: PixelPicture, owner: Uint16Array): SmoothedHeight {
  const { side } = base;
  const levels = new Float32Array(side * side);
  for (let i = 0; i < levels.length; i += 1) levels[i] = owner[i] === 0 ? 0 : base.rgba[i * 4]! / 255;
  const kernel = gaussianKernel(side * SMOOTHING_SIGMA_PER_SIDE);
  const smoothed = blurAlong(blurAlong(levels, owner, side, kernel, true), owner, side, kernel, false);
  const p95 = computePercentile95Slope(computeUnitSlopes(smoothed, { owner, side }), owner);
  return { smoothed, p95, owner, side };
}
