import type { HandleLayout, ScreenPoint } from './dragPlacement';
import { cornersOf, type CopyFrame, type Corner, type Placement } from './placement';

/** Clone R9: how far, in screen pixels, the rotation handle stands beyond the middle of the copy's top edge. */
export const ROTATE_HANDLE_OFFSET = 32;

/**
 * Clone R9, R23: where the handles are on the screen. `toScreen` projects an unwrapped picture point (null when the view cannot show it). The rotation handle is placed
 * in screen space, a fixed distance out along the line from the copy's centre through the middle of its top edge, so it stays reachable at grazing angles.
 */
export function layoutHandles(frame: CopyFrame, placement: Placement, toScreen: (point: Corner) => ScreenPoint | null): HandleLayout | null {
  const picture = cornersOf(frame, placement);
  const corners = picture.map(toScreen);
  const centre = toScreen({ x: placement.cx, y: placement.cy });
  if (centre === null || corners.some((corner) => corner === null)) return null;
  const [a, b, c, d] = corners as [ScreenPoint, ScreenPoint, ScreenPoint, ScreenPoint];
  const top = { x: (c.x + d.x) / 2, y: (c.y + d.y) / 2 };
  const length = Math.hypot(top.x - centre.x, top.y - centre.y);
  if (length < 1e-6) return null;
  const rotate = { x: top.x + ((top.x - centre.x) / length) * ROTATE_HANDLE_OFFSET, y: top.y + ((top.y - centre.y) / length) * ROTATE_HANDLE_OFFSET };
  return { corners: [a, b, c, d], rotate };
}
