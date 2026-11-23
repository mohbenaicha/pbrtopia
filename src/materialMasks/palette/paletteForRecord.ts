import { deltaE76, hexToRgb, rgbToLab, type Lab } from '../color/lab';
import { PALETTE, type LabelColour } from './palette';

export const MAX_RECORD_COLOURS = 32;

const GRID_STEP = 32;
const hexOf = (r: number, g: number, b: number): string => `#${[r, g, b].map((v) => Math.min(255, v).toString(16).padStart(2, '0')).join('').toUpperCase()}`;

let memo: LabelColour[] | null = null;

// mask-mode R13: colours 11 to 32 by farthest-point choice over an RGB grid, starting from the shared ten, so every pair is far apart in Lab and the table never changes.
function buildFullPalette(): LabelColour[] {
  const chosen: LabelColour[] = PALETTE.map((entry, label) => ({ label, hex: entry.hex, name: entry.name }));
  const labs: Lab[] = chosen.map((entry) => rgbToLab(...hexToRgb(entry.hex)));
  const candidates: { hex: string; lab: Lab }[] = [];
  for (let r = 0; r <= 256; r += GRID_STEP) {
    for (let g = 0; g <= 256; g += GRID_STEP) {
      for (let b = 0; b <= 256; b += GRID_STEP) {
        const hex = hexOf(r, g, b);
        candidates.push({ hex, lab: rgbToLab(...hexToRgb(hex)) });
      }
    }
  }
  const taken = new Set(chosen.map((entry) => entry.hex));
  while (chosen.length < MAX_RECORD_COLOURS) {
    let best: { hex: string; lab: Lab } | null = null;
    let bestGap = -1;
    for (const candidate of candidates) {
      if (taken.has(candidate.hex)) continue;
      const gap = Math.min(...labs.map((lab) => deltaE76(lab, candidate.lab)));
      if (gap > bestGap) {
        bestGap = gap;
        best = candidate;
      }
    }
    if (best === null) throw new Error('The colour grid ran out of candidates.');
    taken.add(best.hex);
    labs.push(best.lab);
    chosen.push({ label: chosen.length, hex: best.hex, name: `shade ${chosen.length + 1}` });
  }
  return chosen;
}

export function paletteForRecord(count: number): LabelColour[] {
  if (!Number.isInteger(count) || count < 2 || count > MAX_RECORD_COLOURS) throw new RangeError(`A masks record holds 2 to ${MAX_RECORD_COLOURS} colours, not ${count}.`);
  memo ??= buildFullPalette();
  return memo.slice(0, count).map((entry) => ({ ...entry }));
}
