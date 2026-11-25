import { NONE_LABEL } from '../quantise/classifyPixelsToPalette';
import { MAX_FEATHER, toByte, type BakeRow } from './bakeMasks';
import { grainGains, grainedByte, rowOfLabel } from './colourMixin';
import type { TexelRegion } from './texelRegion';

const BLOCK_SHIFT = 6; // touched texels are reported as one rectangle per 64 x 64 block

export interface RegionBake {
  rows: readonly BakeRow[];
  feather: number;
  which: 'rough' | 'metal';
  changed: readonly number[]; // the labels whose row changed (R4); never 'all' (that is a full bake)
  map: Uint8Array; // the session's map, changed in place
  grey: Uint8Array | null;
  means: Float64Array | undefined; // the mean grey of each row over the whole picture, when a row has the Colour mixin
}

export interface TouchedRegion {
  rects: Array<{ x0: number; y0: number; x1: number; y1: number }>; // x1 and y1 exclusive; at most one per 64 x 64 block
  texels: number; // how many texels were recomputed (the touched gutter texels are copies and are not counted)
}

/**
 * Mask-bake-session R7: the texels of the changed labels, and every masked texel within the feather radius of them, take the value a full bake gives them (mask-mode R14 feather over the
 * masked texels, edges clamp, then the row's grain, masks R91); each is copied into its gutter texels. A texel whose whole window is its own label is set to its table value without a window
 * (the blur of a region of one value is that value, masks R44). Nothing else is read or written.
 */
export function bakeTexelRegion(region: TexelRegion, { rows, feather, which, changed, map, grey, means }: RegionBake): TouchedRegion {
  const { labels, side, runStart, runLength, labelRunStart, targetStart, targets, seen, table: gutterSource } = region;
  const isGutterCopy = (index: number): boolean => gutterSource !== null && gutterSource[index]! >= 0; // filled from its source, never from its own window (a full bake fills the gutter last)
  const last = side - 1;
  const radius = Math.min(Math.max(Math.round(feather), 0), MAX_FEATHER);
  const values = rows.map((row) => toByte(which === 'rough' ? row.rough : row.metal));
  const table = new Uint8Array(256); // label -> table value; a label with no row reads row 0
  for (let label = 0; label < 256; label += 1) table[label] = values[label] ?? values[0] ?? 0;
  const gains = grey !== null && means !== undefined ? grainGains(rows.map((row) => row.mix), which) : null;
  const gainOf = new Float64Array(256); // label -> grain gain of its row (0: no grain)
  const meanOf = new Float64Array(256);
  if (gains !== null && means !== undefined) {
    for (let label = 0; label < 256; label += 1) {
      const row = rowOfLabel(label, rows.length);
      gainOf[label] = gains[row] ?? 0;
      meanOf[label] = means[row] ?? 0;
    }
  }
  const isChanged = new Uint8Array(256);
  for (const label of changed) isChanged[label] = 1;
  if (isChanged[0] === 1) for (let label = rows.length; label < 256; label += 1) isChanged[label] = 1; // a label with no row reads row 0
  isChanged[NONE_LABEL] = 0; // a texel with no mask is never recomputed (mask-mode R14)
  const inner = region.innerOf(radius);
  const mark = region.nextMark();
  const across = Math.ceil(side / (1 << BLOCK_SHIFT));
  const boxes = new Int32Array(across * across * 4);
  for (let block = 0; block < across * across; block += 1) {
    boxes[block * 4] = side;
    boxes[block * 4 + 1] = side;
    boxes[block * 4 + 2] = -1;
    boxes[block * 4 + 3] = -1;
  }
  let texels = 0;
  const touch = (x: number, y: number): void => {
    const at = ((y >> BLOCK_SHIFT) * across + (x >> BLOCK_SHIFT)) * 4;
    if (x < boxes[at]!) boxes[at] = x;
    if (y < boxes[at + 1]!) boxes[at + 1] = y;
    if (x >= boxes[at + 2]!) boxes[at + 2] = x + 1;
    if (y >= boxes[at + 3]!) boxes[at + 3] = y + 1;
  };
  const write = (index: number, x: number, y: number, smooth: number): void => {
    const label = labels[index]!;
    const value = gainOf[label] === 0 ? smooth : grainedByte(smooth, gainOf[label]!, grey![index]!, meanOf[label]!);
    map[index] = value;
    texels += 1;
    touch(x, y);
    if (targetStart === null || targets === null) return;
    for (let at = targetStart[index]!; at < targetStart[index + 1]!; at += 1) {
      const gutter = targets[at]!;
      map[gutter] = value;
      const gutterY = (gutter / side) | 0;
      touch(gutter - gutterY * side, gutterY);
    }
  };
  for (let label = 0; label < 255; label += 1) {
    if (isChanged[label] !== 1) continue;
    for (let run = labelRunStart[label]!; run < labelRunStart[label + 1]!; run += 1) {
      for (let origin = runStart[run]!, end = origin + runLength[run]!; origin < end; origin += 1) {
        const oy = (origin / side) | 0;
        const ox = origin - oy * side;
        if (inner[origin] === 1) {
          // its whole window is its own label, so every neighbour is visited as an origin too
          if (!isGutterCopy(origin)) write(origin, ox, oy, table[label]!);
          continue;
        }
        // a gutter copy is not written from its window, but its table value is in its neighbours' windows, so they are recomputed (the loop below skips the copy itself)
        for (let dy = -radius; dy <= radius; dy += 1) {
          const y = oy + dy;
          if (y < 0 || y > last) continue;
          for (let dx = -radius; dx <= radius; dx += 1) {
            const x = ox + dx;
            if (x < 0 || x > last) continue;
            const index = y * side + x;
            if (seen[index] === mark || labels[index] === NONE_LABEL || isGutterCopy(index)) continue;
            seen[index] = mark;
            let sum = 0;
            let weight = 0;
            const whole = x >= radius && x <= last - radius && y >= radius && y <= last - radius;
            for (let wy = -radius; wy <= radius; wy += 1) {
              const row = (whole ? y + wy : Math.min(Math.max(y + wy, 0), last)) * side;
              for (let wx = -radius; wx <= radius; wx += 1) {
                const near = labels[row + (whole ? x + wx : Math.min(Math.max(x + wx, 0), last))]!;
                if (near === NONE_LABEL) continue;
                sum += table[near]!;
                weight += 1;
              }
            }
            write(index, x, y, Math.round(sum / weight));
          }
        }
      }
    }
  }
  const rects: TouchedRegion['rects'] = [];
  for (let block = 0; block < across * across; block += 1) {
    if (boxes[block * 4 + 2]! < 0) continue;
    rects.push({ x0: boxes[block * 4]!, y0: boxes[block * 4 + 1]!, x1: boxes[block * 4 + 2]!, y1: boxes[block * 4 + 3]! });
  }
  return { rects, texels };
}
