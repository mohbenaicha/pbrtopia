import { describe, expect, it } from 'vitest';
import { drawFrom, createSeed } from '../../../../src/materialgen/compositing/plan/createRandom';

describe('materialgen/compositing seeded generator (R11 R71)', () => {
  it('R11 the same seed gives the same sequence and values lie in [0, 1)', () => {
    const run = (seed: number): number[] => {
      const out: number[] = [];
      let state = createSeed(seed);
      for (let index = 0; index < 50; index += 1) { const draw = drawFrom(state); out.push(draw.value); state = draw.state; }
      return out;
    };
    expect(run(7)).toEqual(run(7));
    expect(run(7)).not.toEqual(run(8));
    for (const value of run(3)) { expect(value).toBeGreaterThanOrEqual(0); expect(value).toBeLessThan(1); }
  });

  it('R11 drawing does not mutate: the same state gives the same draw (a peek costs nothing)', () => {
    const state = createSeed(42);
    expect(drawFrom(state)).toEqual(drawFrom(state));
  });

  it('R11 the values spread over the range (a coarse uniformity check)', () => {
    let state = createSeed(1);
    const buckets = [0, 0, 0, 0];
    for (let index = 0; index < 4000; index += 1) { const draw = drawFrom(state); buckets[Math.floor(draw.value * 4)]! += 1; state = draw.state; }
    for (const count of buckets) { expect(count).toBeGreaterThan(800); expect(count).toBeLessThan(1200); }
  });
});
