import type { SmoothedHeight } from '../../../../src/generation/normal/height/heightTypes';

/** A picture of `side` x `side` heights from a function of the texel; every texel belongs to one island (owner 1). */
export function soleIslandHeight(side: number, at: (x: number, y: number) => number): SmoothedHeight {
  const smoothed = new Float32Array(side * side);
  for (let y = 0; y < side; y += 1) for (let x = 0; x < side; x += 1) smoothed[y * side + x] = at(x, y);
  return { smoothed, p95: 0, owner: new Uint16Array(side * side).fill(1), side };
}

/** Two islands side by side: columns below `split` are owner 1, the others owner 2. */
export function twoIslandHeight(side: number, split: number, left: (x: number, y: number) => number, right: (x: number, y: number) => number): SmoothedHeight {
  const smoothed = new Float32Array(side * side);
  const owner = new Uint16Array(side * side);
  for (let y = 0; y < side; y += 1) {
    for (let x = 0; x < side; x += 1) {
      smoothed[y * side + x] = x < split ? left(x, y) : right(x, y);
      owner[y * side + x] = x < split ? 1 : 2;
    }
  }
  return { smoothed, p95: 0, owner, side };
}

/** The slope width (FWHM of |dh/dx|, the profile smoothed over 5 texels first) and the peak of |dh/dx| of a sampled line, in line steps. */
export function measureSlope(profile: readonly number[], step = 1): { width: number; peak: number } {
  const last = profile.length - 1;
  const smooth = profile.map((_, i) => {
    let sum = 0;
    for (let j = -2; j <= 2; j += 1) sum += profile[Math.min(last, Math.max(0, i + j))]!;
    return sum / 5;
  });
  const gradient = smooth.map((_, i) => Math.abs((smooth[Math.min(last, i + 1)]! - smooth[Math.max(0, i - 1)]!) / 2));
  let peak = 0;
  let peakAt = 0;
  gradient.forEach((value, i) => {
    if (value > peak) {
      peak = value;
      peakAt = i;
    }
  });
  const half = peak / 2;
  let left = peakAt;
  let right = peakAt;
  while (left > 0 && gradient[left - 1]! >= half) left -= 1;
  while (right < last && gradient[right + 1]! >= half) right += 1;
  const crossing = (inside: number, outside: number): number => (gradient[inside]! - half) / (gradient[inside]! - gradient[outside]! + 1e-12);
  const width = right - left + (left > 0 ? crossing(left, left - 1) : 0) + (right < last ? crossing(right, right + 1) : 0);
  return { width: width * step, peak: peak / step };
}
