import { SIZE_DRAG_PIXELS } from '../../plan/resizeByPointer';
import { clampScale, type CopyFrame, type Corner, type Placement } from './placement';

export interface ScreenPoint { x: number; y: number }

/** Where the handles are on the screen (pixels), from the controller's own projection: the four corners in `cornersOf` order and the rotation handle. */
export interface HandleLayout { corners: readonly [ScreenPoint, ScreenPoint, ScreenPoint, ScreenPoint]; rotate: ScreenPoint }

export type Handle = { kind: 'body' } | { kind: 'corner'; index: 0 | 1 | 2 | 3 } | { kind: 'rotate' };

/** Clone R23: handles are about 14 screen pixels, hit in screen space so they work at grazing angles. */
export const HANDLE_RADIUS = 14;
const WHEEL_STEP_DEGREES = 5;
const WHEEL_FINE_STEP_DEGREES = 1;

const distance = (a: ScreenPoint, b: ScreenPoint): number => Math.hypot(a.x - b.x, a.y - b.y);

function isInsideQuad(corners: readonly ScreenPoint[], point: ScreenPoint): boolean {
  let positive = false;
  let negative = false;
  for (let index = 0; index < corners.length; index += 1) {
    const a = corners[index]!;
    const b = corners[(index + 1) % corners.length]!;
    const cross = (b.x - a.x) * (point.y - a.y) - (b.y - a.y) * (point.x - a.x);
    if (cross > 0) positive = true;
    else if (cross < 0) negative = true;
  }
  return !(positive && negative);
}

/** Clone R9: what a press at `point` grabs: the rotation handle, a corner, the body, or nothing. Handles win over the body. */
export function hitHandle(layout: HandleLayout, point: ScreenPoint, radius: number = HANDLE_RADIUS): Handle | null {
  if (distance(layout.rotate, point) <= radius) return { kind: 'rotate' };
  for (let index = 0; index < 4; index += 1) if (distance(layout.corners[index]!, point) <= radius) return { kind: 'corner', index: index as 0 | 1 | 2 | 3 };
  return isInsideQuad(layout.corners, point) ? { kind: 'body' } : null;
}

/** A drag in progress. `last` is the pointer in unwrapped picture fractions, carried from move to move so a drag across an edge keeps going (clone R11). */
export interface Drag { handle: Handle; start: Placement; startPoint: Corner; last: Corner }

const nearest = (value: number, reference: number): number => value - Math.round(value - reference);

/** `startPoint` is the picture point under the pointer when the press happened; it is brought next to the copy's centre, which may be unwrapped far from 0..1. */
export function beginDrag(handle: Handle, startPoint: Corner, start: Placement): Drag {
  const point = { x: nearest(startPoint.x, start.cx), y: nearest(startPoint.y, start.cy) };
  return { handle, start, startPoint: point, last: point };
}

/** The placement after the pointer moved to the picture point `point` (mutates `drag.last`). Body moves, a corner scales about the centre, the rotation handle turns. */
export function dragTo(drag: Drag, point: Corner, frame: CopyFrame): Placement {
  const here = { x: nearest(point.x, drag.last.x), y: nearest(point.y, drag.last.y) };
  drag.last = here;
  const { start, startPoint } = drag;
  if (drag.handle.kind === 'body') return { ...start, cx: start.cx + (here.x - startPoint.x), cy: start.cy + (here.y - startPoint.y) };
  const from = Math.hypot(startPoint.x - start.cx, startPoint.y - start.cy);
  if (drag.handle.kind === 'corner') {
    if (from < 1e-9) return start;
    return { ...start, scale: clampScale(frame, (start.scale * Math.hypot(here.x - start.cx, here.y - start.cy)) / from) };
  }
  const swept = Math.atan2(here.y - start.cy, here.x - start.cx) - Math.atan2(startPoint.y - start.cy, startPoint.x - start.cx);
  return { ...start, angle: start.angle + swept };
}

/** Clone R24: the copy after the pointer moved `dx` pixels sideways with Alt held; 600 pixels multiply the scale by e. A movement that changes nothing returns `placement` itself. */
export function scaleByPointer(placement: Placement, frame: CopyFrame, dx: number): Placement {
  if (!Number.isFinite(dx) || dx === 0) return placement;
  const scale = clampScale(frame, placement.scale * Math.exp(dx / SIZE_DRAG_PIXELS));
  return scale === placement.scale ? placement : { ...placement, scale };
}

/** Clone R9: Alt + wheel turns the copy by 5 degrees a notch, 1 with Shift (a notch is positive for wheel up). */
export function turnByWheel(placement: Placement, notches: number, fine: boolean): Placement {
  if (notches === 0) return placement;
  const step = ((fine ? WHEEL_FINE_STEP_DEGREES : WHEEL_STEP_DEGREES) * Math.PI) / 180;
  return { ...placement, angle: placement.angle + notches * step };
}
