import type { Rect } from '../model/geometry';
import type { SelectionMask } from '../model/selectionMask';

/** Straight-alpha word (0xAABBGGRR) drawn over a selected pixel: a translucent blue. */
export const SELECTION_TINT = 0x59ff8c50;
/** The overlay is tinted this many rows at a time from one reused scratch buffer (architecture D8). */
export const BAND_ROWS = 256;

/** Writes the tint (or 0 for unselected pixels) of `rect` into `out`, row by row. `out` needs rect.w * rect.h words. */
export function fillTint(out: Uint32Array, mask: SelectionMask, rect: Rect): void {
  let k = 0;
  for (let y = rect.y; y < rect.y + rect.h; y += 1) {
    const row = y * mask.width + rect.x;
    for (let x = 0; x < rect.w; x += 1) out[k++] = mask.cells[row + x] === 1 ? SELECTION_TINT : 0;
  }
}

/** The bands (at most BAND_ROWS tall) a rectangle is painted in. */
export function bandsOf(rect: Rect): Rect[] {
  const bands: Rect[] = [];
  for (let y = 0; y < rect.h; y += BAND_ROWS) bands.push({ x: rect.x, y: rect.y + y, w: rect.w, h: Math.min(BAND_ROWS, rect.h - y) });
  return bands;
}

let scratch = new Uint32Array(0);

/** Repaints the overlay canvas for `rects` from the mask (putImageData replaces the pixels, so no clear is needed). Cost: O(area) in bands. */
export function paintSelectionOverlay(ctx: CanvasRenderingContext2D, mask: SelectionMask, rects: readonly Rect[]): void {
  for (const rect of rects) {
    for (const band of bandsOf(rect)) {
      const size = band.w * band.h;
      if (scratch.length < size) scratch = new Uint32Array(Math.max(size, BAND_ROWS * mask.width));
      fillTint(scratch, mask, band);
      const view = new Uint8ClampedArray(scratch.buffer, 0, size * 4);
      ctx.putImageData(new ImageData(view, band.w, band.h), band.x, band.y);
    }
  }
}

/** The rubber band of the rectangle tool: a thin outline in image pixels (`pixelsPerScreenPixel` keeps it one screen pixel wide). */
export function paintRubberBand(ctx: CanvasRenderingContext2D, rect: Rect, pixelsPerScreenPixel: number): void {
  ctx.save();
  ctx.lineWidth = Math.max(1, pixelsPerScreenPixel);
  ctx.strokeStyle = '#ffffff';
  ctx.strokeRect(rect.x + 0.5, rect.y + 0.5, rect.w - 1, rect.h - 1);
  ctx.setLineDash([4 * ctx.lineWidth, 4 * ctx.lineWidth]);
  ctx.strokeStyle = '#000000';
  ctx.strokeRect(rect.x + 0.5, rect.y + 0.5, rect.w - 1, rect.h - 1);
  ctx.restore();
}
