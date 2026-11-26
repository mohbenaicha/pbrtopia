import { emptyBounds, isEmptyBounds, tilesAcross, tilesDown, type Bounds } from './geometry';

/**
 * One byte per pixel (0 or 1; length padded to a multiple of 4 so `words` can view it; padding stays 0).
 * `bounds` is empty iff nothing is selected; it is exact after adds and a superset after an invert.
 * `tileHas[t] === 0` means tile t has no selected cell (a superset flag, never lowered except by clear/invert/replace).
 */
export interface SelectionMask {
  width: number;
  height: number;
  cells: Uint8Array;
  words: Uint32Array;
  bounds: Bounds;
  tileHas: Uint8Array;
}

export function createSelectionMask(width: number, height: number): SelectionMask {
  const buffer = new ArrayBuffer(Math.ceil((width * height) / 4) * 4);
  return { width, height, cells: new Uint8Array(buffer), words: new Uint32Array(buffer), bounds: emptyBounds(), tileHas: new Uint8Array(tilesAcross(width) * tilesDown(height)) };
}

export const hasSelection = (mask: SelectionMask): boolean => !isEmptyBounds(mask.bounds);
export const isSelected = (mask: SelectionMask, x: number, y: number): boolean => x >= 0 && y >= 0 && x < mask.width && y < mask.height && mask.cells[y * mask.width + x] === 1;

/** Marks the cells of row `y`, columns xa..xb (inside the picture), selected and keeps bounds and tile flags. The caller has already called `touchMask`. */
export function addSpan(mask: SelectionMask, y: number, xa: number, xb: number): void {
  const row = y * mask.width;
  mask.cells.fill(1, row + xa, row + xb + 1);
  extendBounds(mask, xa, y, xb, y);
}

export function addRect(mask: SelectionMask, x0: number, y0: number, x1: number, y1: number): void {
  const width = x1 - x0 + 1;
  for (let y = y0; y <= y1; y += 1) mask.cells.fill(1, y * mask.width + x0, y * mask.width + x0 + width);
  extendBounds(mask, x0, y0, x1, y1);
}

function extendBounds(mask: SelectionMask, x0: number, y0: number, x1: number, y1: number): void {
  const bounds = mask.bounds;
  if (x0 < bounds.minX) bounds.minX = x0;
  if (y0 < bounds.minY) bounds.minY = y0;
  if (x1 > bounds.maxX) bounds.maxX = x1;
  if (y1 > bounds.maxY) bounds.maxY = y1;
  const across = tilesAcross(mask.width);
  const tx1 = x1 >> 6;
  for (let ty = y0 >> 6; ty <= y1 >> 6; ty += 1) mask.tileHas.fill(1, ty * across + (x0 >> 6), ty * across + tx1 + 1);
}

/** Shrinks `bounds` to the exact box of the selected cells with one scan of the old bounds (O(bounds area)); empties it when nothing is selected. */
export function tightenBounds(mask: SelectionMask): void {
  const { minX, minY, maxX, maxY } = mask.bounds;
  let lo = 1 << 30;
  let hi = -1;
  let top = -1;
  let bottom = -1;
  for (let y = minY; y <= maxY; y += 1) {
    const row = y * mask.width;
    let first = -1;
    for (let x = minX; x <= maxX; x += 1) if (mask.cells[row + x] === 1) { first = x; break; }
    if (first < 0) continue;
    let last = first;
    for (let x = maxX; x > first; x -= 1) if (mask.cells[row + x] === 1) { last = x; break; }
    if (top < 0) top = y;
    bottom = y;
    if (first < lo) lo = first;
    if (last > hi) hi = last;
  }
  mask.bounds = top < 0 ? emptyBounds() : { minX: lo, minY: top, maxX: hi, maxY: bottom };
}
