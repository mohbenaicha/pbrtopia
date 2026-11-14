import type { BrushParams } from './brushParams';
import { createSeed, drawFrom } from './createRandom';

export interface ShapeSlot {
  index: number; // 0-199, the atlas tile
  invert: boolean; // R5a
}

export interface Point {
  x: number; // picture fraction; plane coordinates times tiling, so a path over a tile seam stays continuous (R16)
  y: number;
}

/** Compositing A3: one placement. Angle in radians. */
export interface Stamp {
  shape: number;
  invert: boolean;
  x: number;
  y: number;
  size: number;
  angle: number;
  strength: number;
  hardness: number;
}

export interface PlanContext {
  params: BrushParams;
  shapes: readonly ShapeSlot[]; // one to three (R5)
  texel: number; // 1 / S: the smallest spacing (R10)
}

/** Where a stroke or a line stands: the generator, the path length walked since the last stamp, and whether the first stamp was placed. */
export interface PlanState {
  rng: number;
  carry: number;
  started: boolean;
}

export interface PeekedStamp {
  shape: number;
  invert: boolean;
  angle: number;
}

export const MAX_STAMPS_PER_CALL = 4096;
const EPSILON = 1e-9;

export const startStroke = (seed: number): PlanState => ({ rng: createSeed(seed), carry: 0, started: false });

// Every stamp consumes exactly two draws, the angle first and the shape second, whatever the switches say, so a peek and a placement always agree (R12).
function drawStamp(ctx: PlanContext, rng: number): { stamp: PeekedStamp; rng: number } {
  const angleDraw = drawFrom(rng);
  const shapeDraw = drawFrom(angleDraw.state);
  const slot = ctx.shapes[Math.min(Math.floor(shapeDraw.value * ctx.shapes.length), ctx.shapes.length - 1)]!;
  const angle = ctx.params.randomRotation ? angleDraw.value * 2 * Math.PI : (ctx.params.rotation * Math.PI) / 180;
  return { stamp: { shape: slot.index, invert: slot.invert, angle }, rng: shapeDraw.state };
}

/** Compositing R12, R14: the shape and angle the next placement will have; it changes nothing. Null while no shape is chosen. */
export function peekNextStamp(ctx: PlanContext, state: PlanState): PeekedStamp | null {
  return ctx.shapes.length === 0 ? null : drawStamp(ctx, state.rng).stamp;
}

const isPoint = (point: Point): boolean => Number.isFinite(point.x) && Number.isFinite(point.y);

/**
 * Compositing R10, R13: the stamps of the path from `from` to `to`, and the state after them. The first call of a stroke or line (`started` false) places a
 * stamp at `from`; the walk then places one every `Distance x footprint` (at least one texel) of path, counted from the last stamp across calls, so any
 * splitting of one path gives the same stamps. Pure: the input state is not touched, so a ghost line and its commit are the same call (R13).
 */
export function planSegment(ctx: PlanContext, state: PlanState, from: Point, to: Point): { stamps: Stamp[]; state: PlanState } {
  if (ctx.shapes.length === 0 || !isPoint(from) || !isPoint(to)) return { stamps: [], state };
  const stamps: Stamp[] = [];
  let { rng, carry } = state;
  const place = (x: number, y: number): void => {
    const drawn = drawStamp(ctx, rng);
    rng = drawn.rng;
    stamps.push({ ...drawn.stamp, x, y, size: ctx.params.size, strength: ctx.params.strength, hardness: ctx.params.hardness });
  };
  if (!state.started) {
    place(from.x, from.y);
    carry = 0;
  }
  const length = Math.hypot(to.x - from.x, to.y - from.y);
  if (length > 0) {
    const spacing = Math.max(ctx.params.distance * ctx.params.size, ctx.texel);
    const first = spacing - carry; // path length from `from` to the next stamp
    let placed = 0;
    let at = first;
    while (at <= length + EPSILON && placed < MAX_STAMPS_PER_CALL) {
      const along = Math.min(at, length) / length;
      place(from.x + (to.x - from.x) * along, from.y + (to.y - from.y) * along);
      placed += 1;
      at = first + placed * spacing;
    }
    carry = placed === 0 ? carry + length : placed >= MAX_STAMPS_PER_CALL ? 0 : length - (first + (placed - 1) * spacing);
  }
  return { stamps, state: { rng, carry, started: true } };
}

/** Compositing R71: the stamps of a whole stroke from its seed and path (press at the first point, then each move); what a stroke log replays to. */
export function planStroke(ctx: PlanContext, seed: number, path: readonly Point[]): Stamp[] {
  let state = startStroke(seed);
  const stamps: Stamp[] = [];
  path.forEach((point, index) => {
    const step = planSegment(ctx, state, index === 0 ? point : path[index - 1]!, point);
    stamps.push(...step.stamps);
    state = step.state;
  });
  return stamps;
}
