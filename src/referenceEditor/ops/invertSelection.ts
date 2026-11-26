import { emptyBounds, type Rect } from '../model/geometry';
import type { SelectionMask } from '../model/selectionMask';

/**
 * Flips every cell of the picture in one flat pass (32 bits at a time, the odd tail bytewise; padding stays 0).
 * Bounds become the whole picture when anything is selected afterwards, else empty; the tile flags follow.
 * Returns the whole-picture rectangle.
 */
export function invertSelection(mask: SelectionMask): Rect {
  const total = mask.width * mask.height;
  const fullWords = total >> 2;
  const words = mask.words;
  let any = 0;
  for (let k = 0; k < fullWords; k += 1) {
    const flipped = (words[k]! ^ 0x01010101) >>> 0;
    words[k] = flipped;
    any |= flipped;
  }
  const cells = mask.cells;
  for (let index = fullWords << 2; index < total; index += 1) {
    const flipped = cells[index]! ^ 1;
    cells[index] = flipped;
    any |= flipped;
  }
  mask.bounds = any !== 0 ? { minX: 0, minY: 0, maxX: mask.width - 1, maxY: mask.height - 1 } : emptyBounds();
  mask.tileHas.fill(any !== 0 ? 1 : 0);
  return { x: 0, y: 0, w: mask.width, h: mask.height };
}
