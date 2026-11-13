import type { PixelImage } from '../gpu/pixelFormats';

const BLUR_SIGMA = 1.4;
const HIGH_SHARE = 0.35; // of the strongest gradient
const LOW_SHARE = 0.15;

function computeLuma(image: PixelImage): Float32Array {
  const { width, height, channels, data } = image;
  const luma = new Float32Array(width * height);
  for (let index = 0; index < luma.length; index += 1) {
    const at = index * channels;
    luma[index] = channels === 1 ? data[at]! : 0.299 * data[at]! + 0.587 * data[at + 1]! + 0.114 * data[at + 2]!;
  }
  return luma;
}

function blurSeparable(source: Float32Array, width: number, height: number): Float32Array {
  const radius = Math.ceil(BLUR_SIGMA * 2);
  const kernel = Array.from({ length: radius * 2 + 1 }, (_, index) => Math.exp(-((index - radius) ** 2) / (2 * BLUR_SIGMA ** 2)));
  const total = kernel.reduce((sum, weight) => sum + weight, 0);
  const clamp = (value: number, max: number): number => Math.min(max, Math.max(0, value));
  const across = new Float32Array(source.length);
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      let sum = 0;
      for (let k = -radius; k <= radius; k += 1) sum += kernel[k + radius]! * source[y * width + clamp(x + k, width - 1)]!;
      across[y * width + x] = sum / total;
    }
  }
  const out = new Float32Array(source.length);
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      let sum = 0;
      for (let k = -radius; k <= radius; k += 1) sum += kernel[k + radius]! * across[clamp(y + k, height - 1) * width + x]!;
      out[y * width + x] = sum / total;
    }
  }
  return out;
}

/**
 * A plain Canny pass for the seam trial: blur, Sobel gradient, thinning along the gradient, then hysteresis from the strong edges. The thresholds are shares of the
 * strongest gradient, so a flat image has no edge. Returns one flag (1 = edge) per pixel.
 */
export function detectEdges(image: PixelImage): Uint8Array {
  const { width, height } = image;
  const smooth = blurSeparable(computeLuma(image), width, height);
  const magnitude = new Float32Array(width * height);
  const sector = new Uint8Array(width * height); // 0 = horizontal gradient, 1 = diagonal /, 2 = vertical, 3 = diagonal \
  let strongest = 0;
  for (let y = 1; y < height - 1; y += 1) {
    for (let x = 1; x < width - 1; x += 1) {
      const at = (dx: number, dy: number): number => smooth[(y + dy) * width + x + dx]!;
      const gx = at(1, -1) + 2 * at(1, 0) + at(1, 1) - at(-1, -1) - 2 * at(-1, 0) - at(-1, 1);
      const gy = at(-1, 1) + 2 * at(0, 1) + at(1, 1) - at(-1, -1) - 2 * at(0, -1) - at(1, -1);
      const strength = Math.hypot(gx, gy);
      magnitude[y * width + x] = strength;
      strongest = Math.max(strongest, strength);
      const angle = ((Math.atan2(gy, gx) * 180) / Math.PI + 180) % 180;
      sector[y * width + x] = angle < 22.5 || angle >= 157.5 ? 0 : angle < 67.5 ? 3 : angle < 112.5 ? 2 : 1;
    }
  }
  const edges = new Uint8Array(width * height);
  if (strongest === 0) return edges;
  const thinned = new Float32Array(width * height);
  const neighbours: ReadonlyArray<readonly [number, number]> = [[1, 0], [1, 1], [0, 1], [-1, 1]];
  for (let y = 1; y < height - 1; y += 1) {
    for (let x = 1; x < width - 1; x += 1) {
      const index = y * width + x;
      const [dx, dy] = neighbours[sector[index]!]!;
      const here = magnitude[index]!;
      if (here >= magnitude[(y + dy) * width + x + dx]! && here >= magnitude[(y - dy) * width + x - dx]!) thinned[index] = here;
    }
  }
  const high = strongest * HIGH_SHARE;
  const low = strongest * LOW_SHARE;
  const stack: number[] = [];
  for (let index = 0; index < thinned.length; index += 1) {
    if (thinned[index]! >= high) {
      edges[index] = 1;
      stack.push(index);
    }
  }
  while (stack.length > 0) {
    const index = stack.pop()!;
    const x = index % width;
    const y = (index - x) / width;
    for (let dy = -1; dy <= 1; dy += 1) {
      for (let dx = -1; dx <= 1; dx += 1) {
        const nx = x + dx;
        const ny = y + dy;
        if (nx < 0 || ny < 0 || nx >= width || ny >= height) continue;
        const next = ny * width + nx;
        if (edges[next] === 0 && thinned[next]! >= low) {
          edges[next] = 1;
          stack.push(next);
        }
      }
    }
  }
  return edges;
}
