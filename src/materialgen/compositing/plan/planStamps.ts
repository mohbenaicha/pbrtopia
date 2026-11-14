import { BRUSH_CONTROLS, drawBrushValue, type BrushParams } from './brushParams';
import { createSeed, drawFrom } from './createRandom';

/** Compositing R43: the shape of a brush with no shape chosen, a plain filled square; no atlas tile backs it. */
export const SQUARE_SHAPE = -1;

export interface ShapeSlot {
  index: number; // 0-199, the atlas tile, or SQUARE_SHAPE
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

/**
 * Where a stroke or a line stands: the generator, the path length walked since the last stamp, whether the first stamp was placed, and the path length from the
 * last stamp to the next one (the drawn Distance times that stamp's footprint, R52).
 */
export interface PlanState {
  rng: number;
  carry: number;
  started: boolean;
  spacing: number;
}

/** What the ghost shows of the next stamp (R12, R14, R53). */
export interface PeekedStamp {
  shape: number;
  invert: boolean;
  angle: number;
  size: number;
}

/** Everything one stamp draws: what a placement needs, and the gap that sets where the following stamp goes. */
interface DrawnStamp extends PeekedStamp {
  strength: number;
  hardness: number;
  gap: number;
}

export const MAX_STAMPS_PER_CALL = 4096;
const EPSILON = 1e-9;

export const startStroke = (seed: number): PlanState => ({ rng: createSeed(seed), carry: 0, started: false, spacing: 0 });

/**
 * Compositing R52: every stamp consumes exactly six draws in a fixed order (angle, shape, size, strength, hardness, gap), a control whose dice is off included, so
 * turning one dice on or off never shifts another control's values and a peek and a placement always agree (R12).
 */
function drawStamp(ctx: PlanContext, rng: number): { drawn: DrawnStamp; rng: number } {
  const { params } = ctx;
  const angle = drawFrom(rng);
  const shape = drawFrom(angle.state);
  const size = drawFrom(shape.state);
  const strength = drawFrom(size.state);
  const hardness = drawFrom(strength.state);
  const gap = drawFrom(hardness.state);
  const slot = ctx.shapes[Math.min(Math.floor(shape.value * ctx.shapes.length), ctx.shapes.length - 1)]!;
  const drawn: DrawnStamp = {
    shape: slot.index,
    invert: slot.invert,
    angle: (drawBrushValue(params.rotation, BRUSH_CONTROLS.rotation, angle.value) * Math.PI) / 180,
    size: drawBrushValue(params.size, BRUSH_CONTROLS.size, size.value),
    strength: drawBrushValue(params.strength, BRUSH_CONTROLS.strength, strength.value),
    hardness: drawBrushValue(params.hardness, BRUSH_CONTROLS.hardness, hardness.value),
    gap: drawBrushValue(params.distance, BRUSH_CONTROLS.distance, gap.value),
  };
  return { drawn, rng: gap.state };
}

/** Compositing R12, R14, R53: the shape, angle and size the next placement will have; it changes nothing. Null while there is no shape to stamp. */
export function peekNextStamp(ctx: PlanContext, state: PlanState): PeekedStamp | null {
  if (ctx.shapes.length === 0) return null;
  const { shape, invert, angle, size } = drawStamp(ctx, state.rng).drawn;
  return { shape, invert, angle, size };
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
  let { rng, carry, spacing } = state;
  const place = (x: number, y: number): void => {
    const next = drawStamp(ctx, rng);
    rng = next.rng;
    const { shape, invert, angle, size, strength, hardness, gap } = next.drawn;
    spacing = Math.max(gap * size, ctx.texel); // R52: from this stamp to the next
    stamps.push({ shape, invert, x, y, size, angle, strength, hardness });
  };
  if (!state.started) {
    place(from.x, from.y);
    carry = 0;
  }
  const length = Math.hypot(to.x - from.x, to.y - from.y);
  if (length > 0) {
    let placed = 0;
    let last = 0; // path length from `from` to the last stamp this call placed
    let at = spacing - carry; // path length from `from` to the next stamp
    while (at <= length + EPSILON && placed < MAX_STAMPS_PER_CALL) {
      const along = Math.min(at, length) / length;
      place(from.x + (to.x - from.x) * along, from.y + (to.y - from.y) * along);
      placed += 1;
      last = at;
      at = last + spacing; // the spacing the stamp just placed has drawn
    }
    carry = placed === 0 ? carry + length : placed >= MAX_STAMPS_PER_CALL ? 0 : Math.max(length - last, 0);
  }
  return { stamps, state: { rng, carry, started: true, spacing } };
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
