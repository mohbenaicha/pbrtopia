// Normal-from-height R5 steps 1 and 1b: a separable Gaussian blur of an S x S float picture, wrapped at the edges (a tiling picture stays seamless).

const wrap = (index: number, side: number): number => ((index % side) + side) % side;

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

/**
 * The blurred copy of `values` (side x side), sigma in texels. The taps of a texel add up in the same order everywhere, so the result is the same
 * whether a texel reads inside the picture (no wrap, the fast path) or across its edge. The vertical pass adds whole rows, so memory is read in order.
 */
export function blurWrapped(values: Float32Array, side: number, sigma: number): Float32Array {
  const kernel = buildGaussianKernel(sigma);
  const radius = (kernel.length - 1) / 2;
  const across = new Float32Array(values.length);
  const result = new Float32Array(values.length);
  const interiorEnd = side - radius;
  for (let y = 0; y < side; y += 1) {
    const row = y * side;
    for (let x = 0; x < side; x += 1) {
      let sum = 0;
      if (x >= radius && x < interiorEnd) {
        const start = row + x - radius;
        for (let k = 0; k < kernel.length; k += 1) sum += kernel[k]! * values[start + k]!;
      } else {
        for (let k = -radius; k <= radius; k += 1) sum += kernel[k + radius]! * values[row + wrap(x + k, side)]!;
      }
      across[row + x] = sum;
    }
  }
  const column = new Float64Array(side);
  for (let y = 0; y < side; y += 1) {
    column.fill(0);
    for (let k = -radius; k <= radius; k += 1) {
      const weight = kernel[k + radius]!;
      const source = wrap(y + k, side) * side;
      for (let x = 0; x < side; x += 1) column[x] = column[x]! + weight * across[source + x]!;
    }
    const row = y * side;
    for (let x = 0; x < side; x += 1) result[row + x] = column[x]!;
  }
  return result;
}
