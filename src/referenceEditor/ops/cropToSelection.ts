import { isEmptyBounds } from '../model/geometry';
import { createRaster, type Raster } from '../model/raster';
import { createSelectionMask, tightenBounds, type SelectionMask } from '../model/selectionMask';

/**
 * Builds the picture of the selection's exact bounding box: selected pixels keep their source colour, unselected pixels inside the box
 * take `colour`. The sources are not modified (history keeps them by reference), except that `mask.bounds` is tightened to the exact box.
 * Cost: O(box area). Returns the new raster and an empty mask of its size.
 */
export function cropToSelection(raster: Raster, mask: SelectionMask, colour: number): { raster: Raster; mask: SelectionMask } {
  tightenBounds(mask);
  if (isEmptyBounds(mask.bounds)) throw new Error('Crop needs a selection');
  const { minX, minY, maxX, maxY } = mask.bounds;
  const width = maxX - minX + 1;
  const height = maxY - minY + 1;
  const out = createRaster(width, height, colour);
  const source = raster.words;
  const cells = mask.cells;
  for (let y = 0; y < height; y += 1) {
    const sourceRow = (y + minY) * raster.width + minX;
    const outRow = y * width;
    for (let x = 0; x < width; x += 1) if (cells[sourceRow + x] === 1) out.words[outRow + x] = source[sourceRow + x]!;
  }
  return { raster: out, mask: createSelectionMask(width, height) };
}
