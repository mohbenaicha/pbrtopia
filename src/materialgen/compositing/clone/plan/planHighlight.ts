import { DEFAULT_BRUSH, type BrushValue } from '../../plan/brushParams';
import { planSegment, SQUARE_SHAPE, startStroke, type PlanContext, type PlanState, type Point } from '../../plan/planStamps';
import type { HighlightStamp } from './highlightBounds';

/** Clone R4: the distance between two highlight stamps, as a fraction of their size: close enough that a drag is continuous at every size. */
export const HIGHLIGHT_SPACING = 0.25;

const single = (value: number): BrushValue => ({ value, random: false, low: value, high: value });

// the planner is the Stamp's own, with the dice off (clone R4: no randomness) and one shape; the shape the highlight paints is the mask material's business
const contextOf = (size: number, side: number): PlanContext => ({
  params: { ...DEFAULT_BRUSH, size: single(size), distance: single(HIGHLIGHT_SPACING), rotation: single(0) },
  shapes: [{ index: SQUARE_SHAPE, invert: false }],
  texel: 1 / side,
});

const toHighlight = (stamps: readonly { x: number; y: number; size: number }[]): HighlightStamp[] => stamps.map(({ x, y, size }) => ({ x, y, size }));

/** A highlight stroke in progress: what the last call placed, and what the next one continues from. */
export interface HighlightRun {
  stamps: HighlightStamp[];
  state: PlanState;
  last: Point;
  size: number;
  side: number;
}

/** The press: one stamp at the point. */
export function startHighlightStroke(size: number, side: number, point: Point): HighlightRun {
  const planned = planSegment(contextOf(size, side), startStroke(0), point, point);
  return { stamps: toHighlight(planned.stamps), state: planned.state, last: point, size, side };
}

/** A move: the stamps from the last point to this one. Any splitting of one path gives the same stamps. A point that is not a number changes nothing. */
export function planHighlightMove(run: HighlightRun, point: Point): HighlightRun {
  const planned = planSegment(contextOf(run.size, run.side), run.state, run.last, point);
  if (planned.stamps.length === 0 && planned.state === run.state) return { ...run, stamps: [] };
  return { ...run, stamps: toHighlight(planned.stamps), state: planned.state, last: point };
}

/** Clone R5: the stamps of the straight run from the line marker to the point, the first at the marker. */
export function planHighlightLine(size: number, side: number, from: Point, to: Point): HighlightStamp[] {
  return toHighlight(planSegment(contextOf(size, side), startStroke(0), from, to).stamps);
}
