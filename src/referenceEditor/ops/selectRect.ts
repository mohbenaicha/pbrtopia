import type { Rect } from '../model/geometry';
import { addRect, type SelectionMask } from '../model/selectionMask';
import type { WriteRecorder } from '../model/writeRecorder';

/** Adds the rectangle (clamped to the picture) to the selection. Cost: O(area), one native fill per row. Returns the clamped rectangle, or null when it is outside. */
export function selectRect(mask: SelectionMask, rect: Rect, recorder: WriteRecorder): Rect | null {
  const x0 = Math.max(0, rect.x);
  const y0 = Math.max(0, rect.y);
  const x1 = Math.min(mask.width - 1, rect.x + rect.w - 1);
  const y1 = Math.min(mask.height - 1, rect.y + rect.h - 1);
  if (x0 > x1 || y0 > y1) return null;
  recorder.touchMask(x0, y0, x1 - x0 + 1, y1 - y0 + 1);
  addRect(mask, x0, y0, x1, y1);
  return { x: x0, y: y0, w: x1 - x0 + 1, h: y1 - y0 + 1 };
}
