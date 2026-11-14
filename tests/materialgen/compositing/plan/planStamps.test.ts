import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { DEFAULT_BRUSH, type BrushParams } from '../../../../src/materialgen/compositing/plan/brushParams';
import { peekNextStamp, planSegment, planStroke, startStroke, type PlanContext } from '../../../../src/materialgen/compositing/plan/planStamps';
import { wrapInstances } from '../../../../src/materialgen/compositing/plan/wrapInstances';

const ctxOf = (params: Partial<BrushParams> = {}, shapes = [{ index: 5, invert: false }]): PlanContext => ({ params: { ...DEFAULT_BRUSH, size: 0.1, ...params }, shapes, texel: 1 / 1024 });
const xs = (stamps: readonly { x: number }[]): number[] => stamps.map((stamp) => Math.round(stamp.x * 1e6) / 1e6);

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

  it('R12 random rotation: each stamp gets its own angle in 0 to 2 pi', () => {
    const stamps = planStroke(ctxOf({ randomRotation: true }), 1, [{ x: 0, y: 0 }, { x: 1, y: 0 }]);
    expect(new Set(stamps.map((stamp) => stamp.angle)).size).toBe(stamps.length);
    for (const stamp of stamps) { expect(stamp.angle).toBeGreaterThanOrEqual(0); expect(stamp.angle).toBeLessThan(2 * Math.PI); }
  });

  it('R12 R14 the peeked next stamp is exactly the one placed next, and peeking does not advance', () => {
    const shapes = [{ index: 1, invert: false }, { index: 2, invert: false }, { index: 3, invert: false }];
    for (const randomRotation of [false, true]) {
      const ctx = ctxOf({ randomRotation, rotation: 33 }, shapes);
      let state = startStroke(21);
      for (let step = 0; step < 6; step += 1) {
        const peek = peekNextStamp(ctx, state)!;
        expect(peekNextStamp(ctx, state)).toEqual(peek);
        const placed = planSegment(ctx, state, { x: step, y: 0 }, { x: step, y: 0 });
        state = placed.state;
        expect([placed.stamps[0]!.shape, placed.stamps[0]!.angle]).toEqual([peek.shape, peek.angle]);
        state = { ...state, started: false, carry: 0 };
      }
    }
  });

  it('R13 the line planned from a marker is pure: the same input gives the same stamps and the input state is untouched', () => {
    const marker = startStroke(5);
    const frozen = JSON.stringify(marker);
    const ghost = planSegment(ctxOf({ randomRotation: true }), marker, { x: 0.1, y: 0.1 }, { x: 0.7, y: 0.4 });
    const commit = planSegment(ctxOf({ randomRotation: true }), marker, { x: 0.1, y: 0.1 }, { x: 0.7, y: 0.4 });
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
    const ctx = ctxOf({ randomRotation: true }, [{ index: 1, invert: false }, { index: 2, invert: true }]);
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
