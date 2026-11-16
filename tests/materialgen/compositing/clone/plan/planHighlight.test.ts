import { describe, expect, it } from 'vitest';
import { HIGHLIGHT_SPACING, planHighlightLine, planHighlightMove, startHighlightStroke } from '@mat/compositing/clone/plan/planHighlight';

const SIDE = 256;

describe('planHighlight (clone R4)', () => {
  it('TestCloneR4_a press places one stamp of the brush size at the point', () => {
    const run = startHighlightStroke(0.1, SIDE, { x: 0.5, y: 0.5 });
    expect(run.stamps).toEqual([{ x: 0.5, y: 0.5, size: 0.1 }]);
  });

  it('TestCloneR4_a drag is continuous: no gap between neighbouring stamps is wider than their size', () => {
    let run = startHighlightStroke(0.1, SIDE, { x: 0.1, y: 0.5 });
    const all = [...run.stamps];
    run = planHighlightMove(run, { x: 0.9, y: 0.5 });
    all.push(...run.stamps);
    const xs = all.map((stamp) => stamp.x).sort((a, b) => a - b);
    for (let index = 1; index < xs.length; index += 1) expect(xs[index]! - xs[index - 1]!).toBeLessThanOrEqual(0.1 + 1e-9);
    expect(all.length).toBeGreaterThan(8);
  });

  it('TestCloneR4_the_spacing_is_fixed_so_the_same_path_gives_the_same_stamps_however_it_is_split', () => {
    const whole = planHighlightMove(startHighlightStroke(0.1, SIDE, { x: 0.1, y: 0.5 }), { x: 0.8, y: 0.5 });
    let split = startHighlightStroke(0.1, SIDE, { x: 0.1, y: 0.5 });
    const parts = [...split.stamps];
    for (const x of [0.3, 0.55, 0.8]) { split = planHighlightMove(split, { x, y: 0.5 }); parts.push(...split.stamps); }
    const first = startHighlightStroke(0.1, SIDE, { x: 0.1, y: 0.5 }).stamps;
    const expected = [...first, ...whole.stamps];
    expect(parts).toHaveLength(expected.length);
    parts.forEach((stamp, index) => expect(stamp.x).toBeCloseTo(expected[index]!.x, 9));
  });

  it('TestCloneR4_the_stamps_are_a_fixed_fraction_of_the_size_apart', () => {
    const run = planHighlightMove(startHighlightStroke(0.2, SIDE, { x: 0.1, y: 0.5 }), { x: 0.6, y: 0.5 });
    expect(run.stamps[1]!.x - run.stamps[0]!.x).toBeCloseTo(0.2 * HIGHLIGHT_SPACING, 6);
  });

  it('TestCloneR5_a straight line from the marker places a stamp at the marker and along the way to the point', () => {
    const stamps = planHighlightLine(0.1, SIDE, { x: 0.2, y: 0.2 }, { x: 0.6, y: 0.2 });
    expect(stamps[0]).toEqual({ x: 0.2, y: 0.2, size: 0.1 });
    expect(stamps[stamps.length - 1]!.x).toBeCloseTo(0.6, 6);
  });

  it('TestCloneR4_a point that is not a number places nothing', () => {
    expect(planHighlightLine(0.1, SIDE, { x: 0.2, y: 0.2 }, { x: Number.NaN, y: 0.2 })).toEqual([]);
  });
});
