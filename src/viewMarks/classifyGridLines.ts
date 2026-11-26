// Snapshot-orientation R3: where the grid lines of one image axis fall.

export const NO_LINE = 0;
export const MINOR_LINE = 1;
export const MAJOR_LINE = 2;

const MAJOR_STEPS_ACROSS_MODEL = 10;
const MINOR_PER_MAJOR = 5;
const MINOR_MIN_SPACING_PX = 4;
const MAJOR_MIN_SPACING_PX = 8;

// The 1, 2 or 5 times a power of ten nearest to a tenth of the model's longest side (a tie takes the larger); 0 for no grid.
export function chooseGridStep(longestSide: number): number {
  if (!Number.isFinite(longestSide) || longestSide <= 0) return 0;
  const target = longestSide / MAJOR_STEPS_ACROSS_MODEL;
  const power = 10 ** Math.floor(Math.log10(target));
  let step = power;
  for (const factor of [2, 5, 10]) if (Math.abs(factor * power - target) <= Math.abs(step - target) * (1 + 1e-9)) step = factor * power;
  return step;
}

// One entry per pixel of an axis that starts at world coordinate `start` and covers `perPixel` units per pixel. Lines lie on
// whole multiples of the step, so every view of a sheet shows the same world grid at its own scale.
export function classifyGridLines(start: number, perPixel: number, count: number, majorStep: number): Uint8Array {
  const lines = new Uint8Array(count);
  if (!(majorStep > 0) || !(perPixel > 0) || majorStep / perPixel < MAJOR_MIN_SPACING_PX) return lines;
  const minorStep = majorStep / MINOR_PER_MAJOR;
  const drawMinor = minorStep / perPixel >= MINOR_MIN_SPACING_PX;
  const first = Math.floor(start / minorStep) - 1;
  const last = Math.ceil((start + count * perPixel) / minorStep);
  for (let index = first; index <= last; index += 1) {
    const major = index % MINOR_PER_MAJOR === 0;
    if (!major && !drawMinor) continue;
    const pixel = Math.floor((index * minorStep - start) / perPixel);
    const width = major ? 2 : 1;
    for (let at = Math.max(0, pixel); at < Math.min(count, pixel + width); at += 1) lines[at] = Math.max(lines[at]!, major ? MAJOR_LINE : MINOR_LINE);
  }
  return lines;
}
