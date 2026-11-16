import type { TexelRect } from '../../gpu/stampGeometry';
import type { LiftRect } from './highlightBounds';

/** The size of the lifted rectangle in picture fractions. */
export interface CopyFrame { w: number; h: number }

/** Where the copy is: the centre in unwrapped picture fractions (v up), a uniform scale, and the turn in radians, counter-clockwise like a stamp's angle. */
export interface Placement { cx: number; cy: number; scale: number; angle: number }

export interface Corner { x: number; y: number }
export interface PlacedCopy { cx: number; cy: number }

/** Clone R9a: the smallest and the largest scale the user can give a copy. */
export const MIN_SCALE = 0.25;
export const MAX_SCALE = 10;
const EPSILON = 1e-9;
const RECT_MARGIN = 1; // texels around a copy's rectangle, for the bilinear fringe

export const frameOf = (rect: LiftRect, side: number): CopyFrame => ({ w: rect.w / side, h: rect.h / side });

/** Clone R8: the copy sits exactly over its source. */
export function startPlacement(rect: LiftRect, side: number): Placement {
  return { cx: (rect.x + rect.w / 2) / side, cy: (rect.y + rect.h / 2) / side, scale: 1, angle: 0 };
}

/** Clone R9a: the largest scale at which the rotated half diagonal stays within half the picture, so the copy lands in one picture width (at most four instances). */
export const maxScaleOf = (frame: CopyFrame): number => Math.min(MAX_SCALE, 0.5 / Math.max(EPSILON, Math.hypot(frame.w, frame.h) / 2));

export const clampScale = (frame: CopyFrame, scale: number): number => Math.min(Math.max(scale, MIN_SCALE), Math.max(MIN_SCALE, maxScaleOf(frame)));

/** The four corners, counter-clockwise from the bottom-left of the unturned copy (so the handles keep their meaning while it turns). */
export function cornersOf(frame: CopyFrame, placement: Placement): [Corner, Corner, Corner, Corner] {
  const hw = (frame.w * placement.scale) / 2;
  const hh = (frame.h * placement.scale) / 2;
  const c = Math.cos(placement.angle);
  const s = Math.sin(placement.angle);
  const at = (dx: number, dy: number): Corner => ({ x: placement.cx + c * dx - s * dy, y: placement.cy + s * dx + c * dy });
  return [at(-hw, -hh), at(hw, -hh), at(hw, hh), at(-hw, hh)];
}

/** The axis-aligned box of the placed copy, in unwrapped picture fractions. */
export function boundsOf(frame: CopyFrame, placement: Placement): { x0: number; y0: number; x1: number; y1: number } {
  const corners = cornersOf(frame, placement);
  const xs = corners.map((corner) => corner.x);
  const ys = corners.map((corner) => corner.y);
  return { x0: Math.min(...xs), y0: Math.min(...ys), x1: Math.max(...xs), y1: Math.max(...ys) };
}

const offsetsOf = (position: number, reach: number): number[] => {
  const offsets = [0];
  if (position - reach < 0) offsets.push(1);
  if (position + reach > 1) offsets.push(-1);
  return offsets;
};

/** Clone R11: the centres, reduced into the picture, at which the copy is drawn so that it continues across the edges: one to four (never more, thanks to R9a). */
export function wrappedCopies(frame: CopyFrame, placement: Placement): PlacedCopy[] {
  const box = boundsOf(frame, placement);
  const hx = (box.x1 - box.x0) / 2;
  const hy = (box.y1 - box.y0) / 2;
  const x = placement.cx - Math.floor(placement.cx);
  const y = placement.cy - Math.floor(placement.cy);
  const copies: PlacedCopy[] = [];
  for (const dx of offsetsOf(x, hx)) for (const dy of offsetsOf(y, hy)) copies.push({ cx: x + dx, cy: y + dy });
  return copies;
}

/** Clone R16: one texel rectangle per wrapped copy (never their union, which can span a whole axis), clamped to the picture. */
export function copyRects(frame: CopyFrame, placement: Placement, side: number): TexelRect[] {
  const box = boundsOf(frame, placement);
  const hx = (box.x1 - box.x0) / 2;
  const hy = (box.y1 - box.y0) / 2;
  const rects: TexelRect[] = [];
  for (const copy of wrappedCopies(frame, placement)) {
    const x0 = Math.max(0, Math.floor((copy.cx - hx) * side + EPSILON) - RECT_MARGIN);
    const x1 = Math.min(side, Math.ceil((copy.cx + hx) * side - EPSILON) + RECT_MARGIN);
    const y0 = Math.max(0, Math.floor((copy.cy - hy) * side + EPSILON) - RECT_MARGIN);
    const y1 = Math.min(side, Math.ceil((copy.cy + hy) * side - EPSILON) + RECT_MARGIN);
    if (x1 > x0 && y1 > y0) rects.push({ x0, y0, x1, y1 });
  }
  return rects;
}

/** Clone R12: whether the copy differs from where it was lifted; a whole picture away, or a full turn, is the same place. */
export function isMoved(start: Placement, current: Placement): boolean {
  const wrapped = (value: number): number => value - Math.round(value);
  const turn = (current.angle - start.angle) / (2 * Math.PI);
  return Math.abs(wrapped(current.cx - start.cx)) > 1e-6 || Math.abs(wrapped(current.cy - start.cy)) > 1e-6
    || Math.abs(current.scale - start.scale) > 1e-6 || Math.abs(wrapped(turn)) > 1e-6;
}
