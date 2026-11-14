import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { DEFAULT_BRUSH, updateBrushValue, type BrushControlKey, type BrushParams } from '../../../../src/materialgen/compositing/plan/brushParams';
import { peekNextStamp, planSegment, planStroke, startStroke, type PlanContext } from '../../../../src/materialgen/compositing/plan/planStamps';
import { wrapInstances } from '../../../../src/materialgen/compositing/plan/wrapInstances';

type Fixed = Partial<Record<BrushControlKey, number>>;
type Dice = Partial<Record<BrushControlKey, readonly [number, number]>>;
/** A brush with these single values (dice off) and these ranges (dice on, the range given as low and high). */
const brushOf = (fixed: Fixed, dice: Dice = {}): BrushParams => {
  let brush: BrushParams = DEFAULT_BRUSH;
  for (const [key, value] of Object.entries(fixed) as [BrushControlKey, number][]) brush = updateBrushValue(brush, key, { value });
  for (const [key, [low, high]] of Object.entries(dice) as [BrushControlKey, readonly [number, number]][]) brush = updateBrushValue(brush, key, { random: true, low, high });
  return brush;
};
const ctxOf = (fixed: Fixed = {}, shapes = [{ index: 5, invert: false }], dice: Dice = {}): PlanContext => ({ params: brushOf({ size: 0.1, ...fixed }, dice), shapes, texel: 1 / 1024 });
const xs = (stamps: readonly { x: number }[]): number[] => stamps.map((stamp) => Math.round(stamp.x * 1e6) / 1e6);
const FULL_TURN = { rotation: [-180, 180] } as const;

describe('materialgen/compositing stamp planning (R10 R11 R12 R13)', () => {
  it('R10 a press places one stamp at the pointer and nothing else', () => {
    const { stamps, state } = planSegment(ctxOf(), startStroke(1), { x: 0.4, y: 0.6 }, { x: 0.4, y: 0.6 });
    expect(stamps).toHaveLength(1);
    expect([stamps[0]!.x, stamps[0]!.y, stamps[0]!.size]).toEqual([0.4, 0.6, 0.1]);
    expect(state.carry).toBe(0);
  });

  it('R10 a drag places a stamp every Distance x footprint of path (edge to edge by default)', () => {
    const press = planSegment(ctxOf(), startStroke(1), { x: 0, y: 0.5 }, { x: 0, y: 0.5 });
    const move = planSegment(ctxOf(), press.state, { x: 0, y: 0.5 }, { x: 0.5, y: 0.5 });
    expect(xs(move.stamps)).toEqual([0.1, 0.2, 0.3, 0.4, 0.5]);
  });

  it('R10 Distance scales the spacing', () => {
    const press = planSegment(ctxOf({ distance: 0.5 }), startStroke(1), { x: 0, y: 0 }, { x: 0, y: 0 });
    const move = planSegment(ctxOf({ distance: 0.5 }), press.state, { x: 0, y: 0 }, { x: 0.2, y: 0 });
    expect(xs(move.stamps)).toEqual([0.05, 0.1, 0.15, 0.2]);
  });

  it('R10 the remainder carries across move events: the same path in any pieces gives the same stamps', () => {
    // splitting one straight segment at arbitrary points, with a repeated point, does not move any stamp
    const straight = planStroke(ctxOf(), 9, [{ x: 0, y: 0 }, { x: 0.8, y: 0 }]);
    const split = planStroke(ctxOf(), 9, [{ x: 0, y: 0 }, { x: 0.137, y: 0 }, { x: 0.137, y: 0 }, { x: 0.52, y: 0 }, { x: 0.8, y: 0 }]);
    expect(xs(split)).toEqual(xs(straight));
  });

  it('R10 zero-length and duplicate moves add nothing', () => {
    const press = planSegment(ctxOf(), startStroke(1), { x: 0.5, y: 0.5 }, { x: 0.5, y: 0.5 });
    const same = planSegment(ctxOf(), press.state, { x: 0.5, y: 0.5 }, { x: 0.5, y: 0.5 });
    expect(same.stamps).toEqual([]);
    expect(same.state).toEqual(press.state);
  });

  it('R10 R32 a spacing below one texel is raised to one texel, and a NaN point places nothing', () => {
    const tiny = ctxOf({ size: 0.02, distance: 0.05 });
    const press = planSegment(tiny, startStroke(1), { x: 0, y: 0 }, { x: 0, y: 0 });
    const move = planSegment(tiny, press.state, { x: 0, y: 0 }, { x: 0.01, y: 0 });
    expect(move.stamps.length).toBeLessThanOrEqual(Math.floor(0.01 / tiny.texel));
    const bad = planSegment(ctxOf(), startStroke(1), { x: Number.NaN, y: 0 }, { x: 0.5, y: 0 });
    expect(bad.stamps).toEqual([]);
  });

  it('R11 one shape: every stamp uses it, with its invert flag', () => {
    const stamps = planStroke(ctxOf({}, [{ index: 17, invert: true }]), 3, [{ x: 0, y: 0 }, { x: 1, y: 0 }]);
    expect(stamps.length).toBeGreaterThan(5);
    expect(new Set(stamps.map((stamp) => `${stamp.shape}/${stamp.invert}`))).toEqual(new Set(['17/true']));
  });

  it('R11 three shapes: all three appear, each keeping its own invert flag, and the same seed repeats', () => {
    const shapes = [{ index: 1, invert: false }, { index: 2, invert: true }, { index: 3, invert: false }];
    const path = [{ x: 0, y: 0 }, { x: 3, y: 0 }];
    const first = planStroke(ctxOf({}, shapes), 11, path);
    expect(new Set(first.map((stamp) => stamp.shape))).toEqual(new Set([1, 2, 3]));
    for (const stamp of first) expect(stamp.invert).toBe(stamp.shape === 2);
    expect(planStroke(ctxOf({}, shapes), 11, path)).toEqual(first);
    expect(planStroke(ctxOf({}, shapes), 12, path)).not.toEqual(first);
  });

  it('R12 fixed rotation: every stamp carries the Rotation value (in radians)', () => {
    const stamps = planStroke(ctxOf({ rotation: 90 }), 1, [{ x: 0, y: 0 }, { x: 0.5, y: 0 }]);
    for (const stamp of stamps) expect(stamp.angle).toBeCloseTo(Math.PI / 2, 10);
  });

  it('R12 R50 the Rotation dice: each stamp gets its own angle in the range, the full turn by default', () => {
    const stamps = planStroke(ctxOf({}, undefined, FULL_TURN), 1, [{ x: 0, y: 0 }, { x: 1, y: 0 }]);
    expect(new Set(stamps.map((stamp) => stamp.angle)).size).toBe(stamps.length);
    for (const stamp of stamps) { expect(stamp.angle).toBeGreaterThanOrEqual(-Math.PI); expect(stamp.angle).toBeLessThan(Math.PI); }
  });

  it('R50 a narrower Rotation range keeps every angle inside it', () => {
    const stamps = planStroke(ctxOf({}, undefined, { rotation: [10, 40] }), 1, [{ x: 0, y: 0 }, { x: 1, y: 0 }]);
    for (const stamp of stamps) { expect(stamp.angle).toBeGreaterThanOrEqual((10 * Math.PI) / 180); expect(stamp.angle).toBeLessThan((40 * Math.PI) / 180); }
  });

  it('R12 R14 R53 the peeked next stamp (shape, angle, size) is exactly the one placed next, and peeking does not advance', () => {
    const shapes = [{ index: 1, invert: false }, { index: 2, invert: false }, { index: 3, invert: false }];
    for (const dice of [{}, { ...FULL_TURN, size: [0.03, 0.4] as const }]) {
      const ctx = ctxOf({ rotation: 33 }, shapes, dice);
      let state = startStroke(21);
      for (let step = 0; step < 6; step += 1) {
        const peek = peekNextStamp(ctx, state)!;
        expect(peekNextStamp(ctx, state)).toEqual(peek);
        const placed = planSegment(ctx, state, { x: step, y: 0 }, { x: step, y: 0 });
        state = placed.state;
        expect([placed.stamps[0]!.shape, placed.stamps[0]!.angle, placed.stamps[0]!.size]).toEqual([peek.shape, peek.angle, peek.size]);
        state = { ...state, started: false, carry: 0 };
      }
    }
  });

  it('R13 the line planned from a marker is pure: the same input gives the same stamps and the input state is untouched', () => {
    const marker = startStroke(5);
    const frozen = JSON.stringify(marker);
    const everything = { ...FULL_TURN, size: [0.03, 0.2] as const, strength: [0, 1] as const, hardness: [0, 1] as const, distance: [0.5, 1.5] as const };
    const ghost = planSegment(ctxOf({}, undefined, everything), marker, { x: 0.1, y: 0.1 }, { x: 0.7, y: 0.4 });
    const commit = planSegment(ctxOf({}, undefined, everything), marker, { x: 0.1, y: 0.1 }, { x: 0.7, y: 0.4 });
    expect(commit).toEqual(ghost);
    expect(JSON.stringify(marker)).toBe(frozen);
    expect(ghost.stamps[0]).toMatchObject({ x: 0.1, y: 0.1 });
  });

  it('R13 a second line from the end of the first continues the spacing and places no duplicate stamp at the joint', () => {
    const first = planSegment(ctxOf(), startStroke(2), { x: 0, y: 0 }, { x: 0.25, y: 0 });
    const second = planSegment(ctxOf(), first.state, { x: 0.25, y: 0 }, { x: 0.55, y: 0 });
    expect(xs(first.stamps)).toEqual([0, 0.1, 0.2]);
    expect(xs(second.stamps)).toEqual([0.3, 0.4, 0.5]);
  });

  it('R71 a stroke log (seed + path) replays to the identical stamps, in any grouping of the path', () => {
    const ctx = ctxOf({}, [{ index: 1, invert: false }, { index: 2, invert: true }], { ...FULL_TURN, size: [0.03, 0.2], distance: [0.5, 1.5] });
    const path = [{ x: 0.1, y: 0.1 }, { x: 0.2, y: 0.5 }, { x: 0.9, y: 0.3 }];
    const live: ReturnType<typeof planStroke> = [];
    let state = startStroke(77);
    const first = planSegment(ctx, state, path[0]!, path[0]!);
    live.push(...first.stamps); state = first.state;
    for (let index = 1; index < path.length; index += 1) { const next = planSegment(ctx, state, path[index - 1]!, path[index]!); live.push(...next.stamps); state = next.state; }
    expect(planStroke(ctx, 77, path)).toEqual(live);
  });

  it('R16 stamps keep their unwrapped coordinates (a path over the seam of a tiled plane stays one line)', () => {
    const stamps = planStroke(ctxOf(), 1, [{ x: 0.85, y: 0 }, { x: 1.25, y: 0 }]);
    expect(xs(stamps)).toEqual([0.85, 0.95, 1.05, 1.15, 1.25]);
  });
});

describe('materialgen/compositing random ranges in the planner (R50 R52)', () => {
  const shapes = [{ index: 1, invert: false }, { index: 2, invert: true }, { index: 3, invert: false }];
  const line = [{ x: 0, y: 0.5 }, { x: 2, y: 0.5 }];

  it('R52 dice off: every stamp uses the control values, and the same seed and path give the same stamps', () => {
    const stamps = planStroke(ctxOf({ size: 0.07, strength: 0.6, hardness: 0.3 }), 4, line);
    for (const stamp of stamps) expect([stamp.size, stamp.strength, stamp.hardness]).toEqual([0.07, 0.6, 0.3]);
    expect(planStroke(ctxOf({ size: 0.07, strength: 0.6, hardness: 0.3 }), 4, line)).toEqual(stamps);
  });

  it('R52 a dice on Size, Strength or Hardness gives each stamp its own value inside the range', () => {
    const stamps = planStroke(ctxOf({}, shapes, { size: [0.05, 0.15], strength: [0.2, 0.6], hardness: [0.4, 0.5] }), 8, line);
    expect(stamps.length).toBeGreaterThan(8);
    for (const stamp of stamps) {
      expect(stamp.size).toBeGreaterThanOrEqual(0.05); expect(stamp.size).toBeLessThan(0.15);
      expect(stamp.strength).toBeGreaterThanOrEqual(0.2); expect(stamp.strength).toBeLessThan(0.6);
      expect(stamp.hardness).toBeGreaterThanOrEqual(0.4); expect(stamp.hardness).toBeLessThan(0.5);
    }
    for (const key of ['size', 'strength', 'hardness'] as const) expect(new Set(stamps.map((stamp) => stamp[key])).size).toBe(stamps.length);
  });

  it('R52 the full range of Size reaches the whole picture, and a drawn Size stays inside the control', () => {
    const stamps = planStroke(ctxOf({}, shapes, { size: [0.02, 1] }), 2, [{ x: 0.5, y: 0.5 }, { x: 6, y: 0.5 }]);
    expect(Math.max(...stamps.map((stamp) => stamp.size))).toBeLessThanOrEqual(1);
    expect(Math.min(...stamps.map((stamp) => stamp.size))).toBeGreaterThanOrEqual(0.02);
  });

  it('R52 turning one dice on or off never changes the shape and angle of any stamp (the draws are always consumed in the same order)', () => {
    const base = planStroke(ctxOf({ rotation: 20 }, shapes, FULL_TURN), 5, line);
    for (const other of [{ size: [0.05, 0.12] }, { strength: [0, 1] }, { hardness: [0, 1] }, { distance: [0.8, 1.2] }] as Dice[]) {
      const changed = planStroke(ctxOf({ rotation: 20 }, shapes, { ...FULL_TURN, ...other }), 5, line);
      const count = Math.min(base.length, changed.length, 8);
      expect(changed.slice(0, count).map((stamp) => [stamp.shape, stamp.invert, stamp.angle])).toEqual(base.slice(0, count).map((stamp) => [stamp.shape, stamp.invert, stamp.angle]));
    }
  });

  it('R52 the Distance dice: the gap to the next stamp is the drawn Distance times the footprint of the stamp just placed', () => {
    const stamps = planStroke(ctxOf({}, shapes, { distance: [0.5, 1.5], size: [0.05, 0.15] }), 3, line);
    expect(stamps.length).toBeGreaterThan(8);
    const gaps = stamps.slice(1).map((stamp, index) => stamp.x - stamps[index]!.x);
    gaps.forEach((gap, index) => {
      const footprint = stamps[index]!.size;
      expect(gap).toBeGreaterThanOrEqual(0.5 * footprint - 1e-9);
      expect(gap).toBeLessThanOrEqual(1.5 * footprint + 1e-9);
    });
    expect(new Set(gaps.map((gap) => gap.toFixed(6))).size).toBeGreaterThan(gaps.length / 2);
  });

  it('R52 the first stamp of a stroke is placed at the press as before, and a gap below one texel is raised to one texel', () => {
    const stamps = planStroke(ctxOf({}, shapes, { distance: [0.05, 0.05], size: [0.02, 0.02] }), 3, [{ x: 0.3, y: 0.5 }, { x: 0.31, y: 0.5 }]);
    expect(stamps[0]).toMatchObject({ x: 0.3, y: 0.5 });
    expect(stamps.length).toBeLessThanOrEqual(1 + Math.floor(0.01 * 1024));
    expect(stamps.slice(1).every((stamp, index) => stamp.x - stamps[index]!.x >= 1 / 1024 - 1e-9)).toBe(true);
  });

  it('R52 R71 any splitting of the path gives the same stamps with every dice on, and the peek before each move is its next stamp', () => {
    const everything: Dice = { ...FULL_TURN, size: [0.03, 0.2], strength: [0, 1], hardness: [0, 1], distance: [0.5, 1.5] };
    const ctx = ctxOf({}, shapes, everything);
    const whole = planStroke(ctx, 9, [{ x: 0, y: 0 }, { x: 1.6, y: 0 }]);
    const split = planStroke(ctx, 9, [{ x: 0, y: 0 }, { x: 0.137, y: 0 }, { x: 0.137, y: 0 }, { x: 0.52, y: 0 }, { x: 1.1, y: 0 }, { x: 1.6, y: 0 }]);
    expect(xs(split)).toEqual(xs(whole)); // positions agree to the last bit but one, as in R10's test
    const values = (stamps: typeof whole) => stamps.map((stamp) => [stamp.shape, stamp.invert, stamp.angle, stamp.size, stamp.strength, stamp.hardness]);
    expect(values(split)).toEqual(values(whole));
    let state = startStroke(9);
    const first = peekNextStamp(ctx, state)!;
    state = planSegment(ctx, state, { x: 0, y: 0 }, { x: 0, y: 0 }).state;
    expect([whole[0]!.shape, whole[0]!.angle, whole[0]!.size]).toEqual([first.shape, first.angle, first.size]);
    const second = peekNextStamp(ctx, state)!;
    expect([whole[1]!.shape, whole[1]!.angle, whole[1]!.size]).toEqual([second.shape, second.angle, second.size]);
  });

  it('R52 a different seed gives different values', () => {
    const ctx = ctxOf({}, shapes, { size: [0.03, 0.2] });
    expect(planStroke(ctx, 1, line).map((stamp) => stamp.size)).not.toEqual(planStroke(ctx, 2, line).map((stamp) => stamp.size));
  });
});

describe('materialgen/compositing wrap instances (R16 R28)', () => {
  const at = (x: number, y: number, size = 0.1) => wrapInstances({ x, y, size });
  const key = (list: readonly { x: number; y: number }[]): string[] => list.map((item) => `${item.x.toFixed(3)},${item.y.toFixed(3)}`).sort();

  it('R16 a stamp in the middle is one instance', () => {
    expect(key(at(0.5, 0.5))).toEqual(['0.500,0.500']);
  });

  it('R16 near an edge it adds one instance on the opposite side, at a corner it adds three', () => {
    expect(key(at(0.02, 0.5))).toEqual(['0.020,0.500', '1.020,0.500']);
    expect(key(at(0.98, 0.5))).toEqual(['-0.020,0.500', '0.980,0.500']);
    expect(at(0.01, 0.99)).toHaveLength(4);
  });

  it('R16 unwrapped coordinates are reduced into the picture first', () => {
    expect(key(at(1.5, -0.5))).toEqual(['0.500,0.500']);
    expect(key(at(1.02, 0.5))).toEqual(['0.020,0.500', '1.020,0.500']);
  });

  it('R16 the reach of a rotated square (half diagonal) decides, not the half side', () => {
    expect(at(0.06, 0.5, 0.1)).toHaveLength(2); // 0.06 - 0.0707 < 0
    expect(at(0.08, 0.5, 0.1)).toHaveLength(1);
  });
});

describe('materialgen/compositing plan purity (R70)', () => {
  it('R70 no file of plan/ imports three, the DOM or the GPU code', () => {
    const dir = join(__dirname, '../../../../src/materialgen/compositing/plan');
    for (const name of readdirSync(dir)) {
      const text = readFileSync(join(dir, name), 'utf8');
      expect(text, name).not.toMatch(/from 'three'|from "three"|document\.|window\.|\.\.\/gpu|\.\.\/session|\.\.\/ui/);
    }
  });
});
