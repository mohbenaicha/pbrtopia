import type { Rect } from '../model/geometry';
import { addSpan, type SelectionMask } from '../model/selectionMask';
import type { WriteRecorder } from '../model/writeRecorder';
import { capsuleSpans, type Segment } from './capsuleSpans';

/** Adds the pixels of the brush swept along `seg` to the selection. Cost: O(new covered pixels), native fill per span. Null when no pixel is in the picture. */
export function selectStroke(mask: SelectionMask, seg: Segment, size: number, recorder: WriteRecorder): Rect | null {
  let minX = Infinity;
  let maxX = -1;
  let minY = Infinity;
  let maxY = -1;
  capsuleSpans(seg, size, mask.width, mask.height, (y, xa, xb) => {
    recorder.touchMask(xa, y, xb - xa + 1, 1);
    addSpan(mask, y, xa, xb);
    if (xa < minX) minX = xa;
    if (xb > maxX) maxX = xb;
    if (y < minY) minY = y;
    if (y > maxY) maxY = y;
  });
  return maxX < 0 ? null : { x: minX, y: minY, w: maxX - minX + 1, h: maxY - minY + 1 };
}
