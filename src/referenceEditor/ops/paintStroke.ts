import type { Rect } from '../model/geometry';
import type { Raster } from '../model/raster';
import type { SelectionMask } from '../model/selectionMask';
import type { WriteRecorder } from '../model/writeRecorder';
import { capsuleSpans, type Segment } from './capsuleSpans';

/**
 * Paints `colour` along `seg` with a hard round brush of diameter `size`. With a `mask`, only selected pixels change.
 * Returns the rectangle written, or null when nothing was. Cost: O(new covered pixels); unclipped spans use native fill.
 */
export function paintStroke(raster: Raster, mask: SelectionMask | null, seg: Segment, size: number, colour: number, recorder: WriteRecorder): Rect | null {
  const { width, words } = raster;
  let minX = Infinity;
  let maxX = -1;
  let minY = Infinity;
  let maxY = -1;
  const note = (y: number, xa: number, xb: number): void => {
    if (xa < minX) minX = xa;
    if (xb > maxX) maxX = xb;
    if (y < minY) minY = y;
    if (y > maxY) maxY = y;
  };
  capsuleSpans(seg, size, width, raster.height, (y, xa, xb) => {
    const row = y * width;
    if (mask === null) {
      recorder.touchRaster(xa, y, xb - xa + 1, 1);
      words.fill(colour, row + xa, row + xb + 1);
      note(y, xa, xb);
      return;
    }
    const cells = mask.cells;
    let x = xa;
    while (x <= xb) {
      while (x <= xb && cells[row + x] !== 1) x += 1;
      if (x > xb) break;
      const start = x;
      while (x <= xb && cells[row + x] === 1) x += 1;
      recorder.touchRaster(start, y, x - start, 1);
      words.fill(colour, row + start, row + x);
      note(y, start, x - 1);
    }
  });
  return maxX < 0 ? null : { x: minX, y: minY, w: maxX - minX + 1, h: maxY - minY + 1 };
}
