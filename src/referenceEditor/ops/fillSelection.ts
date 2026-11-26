import { isEmptyBounds, TILE, tilesAcross, type Rect } from '../model/geometry';
import type { Raster } from '../model/raster';
import type { SelectionMask } from '../model/selectionMask';
import type { WriteRecorder } from '../model/writeRecorder';

/**
 * Gives every selected pixel `colour`. Visits only the tiles inside the bounds that may hold a selected cell (a sparse selection
 * does not cost its bounding box). Returns the rectangle written, or null when nothing is selected.
 */
export function fillSelection(raster: Raster, mask: SelectionMask, colour: number, recorder: WriteRecorder): Rect | null {
  if (isEmptyBounds(mask.bounds)) return null;
  const { minX, minY, maxX, maxY } = mask.bounds;
  const across = tilesAcross(mask.width);
  const { cells } = mask;
  const { words } = raster;
  const width = raster.width;
  let rx0 = Infinity;
  let rx1 = -1;
  let ry0 = Infinity;
  let ry1 = -1;
  for (let ty = minY >> 6; ty <= maxY >> 6; ty += 1) {
    for (let tx = minX >> 6; tx <= maxX >> 6; tx += 1) {
      if (mask.tileHas[ty * across + tx] === 0) continue;
      const x0 = Math.max(minX, tx * TILE);
      const x1 = Math.min(maxX, tx * TILE + TILE - 1);
      const y0 = Math.max(minY, ty * TILE);
      const y1 = Math.min(maxY, ty * TILE + TILE - 1);
      for (let y = y0; y <= y1; y += 1) {
        const row = y * width;
        let x = x0;
        while (x <= x1) {
          while (x <= x1 && cells[row + x] !== 1) x += 1;
          if (x > x1) break;
          const start = x;
          while (x <= x1 && cells[row + x] === 1) x += 1;
          recorder.touchRaster(start, y, x - start, 1);
          words.fill(colour, row + start, row + x);
          if (start < rx0) rx0 = start;
          if (x - 1 > rx1) rx1 = x - 1;
          if (y < ry0) ry0 = y;
          if (y > ry1) ry1 = y;
        }
      }
    }
  }
  return rx1 < 0 ? null : { x: rx0, y: ry0, w: rx1 - rx0 + 1, h: ry1 - ry0 + 1 };
}
