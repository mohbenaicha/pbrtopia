import { describe, expect, it } from 'vitest';
import type { BakedMaps, PixelImage } from '@shared/materialMasks';
import { dilateGutter, gutterReach } from '@shared/materialMasks';

const plane = (side: number, fill: number): PixelImage => ({ width: side, height: side, channels: 1, data: new Uint8Array(side * side).fill(fill) });
const maps = (side: number, rough = 0, metal = 0): BakedMaps => ({ rough: plane(side, rough), metal: plane(side, metal) });
const noCoverage = (side: number): Uint8Array => new Uint8Array(side * side);
const at = (side: number, row: number, column: number): number => row * side + column;

/** One island texel at (row, column) holding rough 200 and metal 90, the rest start pixels 10 and 20. */
function oneIslandTexel(side: number, row: number, column: number): { maps: BakedMaps; coverage: Uint8Array } {
  const baked = maps(side, 10, 20);
  const coverage = noCoverage(side);
  coverage[at(side, row, column)] = 1;
  baked.rough.data[at(side, row, column)] = 200;
  baked.metal.data[at(side, row, column)] = 90;
  return { maps: baked, coverage };
}

describe('gutterReach (mask-mode R28)', () => {
  it.each([
    [64, 1],
    [1024, 16],
    [1025, 17],
    [2048, 32],
    [4096, 64],
  ])('mask-mode R28 the reach at S = %i is ceil(16 x S / 1024) = %i texels', (side, reach) => {
    expect(gutterReach(side)).toBe(reach);
  });
});

describe('dilateGutter (mask-mode R28)', () => {
  it('mask-mode R28 a gutter texel within reach takes the nearest island texel\'s rough and metal', () => {
    const { maps: baked, coverage } = oneIslandTexel(1024, 500, 100);
    const out = dilateGutter(baked, coverage);
    expect([out.rough.data[at(1024, 500, 101)], out.metal.data[at(1024, 500, 101)]]).toEqual([200, 90]);
    expect([out.rough.data[at(1024, 503, 100)], out.metal.data[at(1024, 503, 100)]]).toEqual([200, 90]);
  });

  it('mask-mode R28 the reach boundary at S = 1024: 15 and 16 texels away are filled, 17 is not', () => {
    const { maps: baked, coverage } = oneIslandTexel(1024, 500, 100);
    const out = dilateGutter(baked, coverage);
    expect(out.rough.data[at(1024, 500, 100 + 15)]).toBe(200);
    expect(out.rough.data[at(1024, 500, 100 + 16)]).toBe(200);
    expect(out.rough.data[at(1024, 500, 100 + 17)]).toBe(10);
  });

  it('mask-mode R28 distance is Euclidean: a texel 12 across and 12 down (17 away) is beyond reach', () => {
    const { maps: baked, coverage } = oneIslandTexel(1024, 500, 100);
    const out = dilateGutter(baked, coverage);
    expect(out.rough.data[at(1024, 512, 112)]).toBe(10);
    expect(out.rough.data[at(1024, 511, 111)]).toBe(200); // 15.6 away
  });

  it('mask-mode R28 at S = 64 the reach is one texel: the four neighbours are filled, the diagonal is not', () => {
    const { maps: baked, coverage } = oneIslandTexel(64, 30, 30);
    const out = dilateGutter(baked, coverage);
    for (const [row, column] of [[29, 30], [31, 30], [30, 29], [30, 31]] as const) expect(out.rough.data[at(64, row, column)]).toBe(200);
    expect(out.rough.data[at(64, 31, 31)]).toBe(10);
    expect(out.rough.data[at(64, 30, 32)]).toBe(10);
  });

  it('mask-mode R28 island texels keep their pixels, whatever surrounds them', () => {
    const baked = maps(64, 10, 20);
    const coverage = noCoverage(64);
    for (let column = 10; column < 14; column += 1) {
      coverage[at(64, 20, column)] = 1;
      baked.rough.data[at(64, 20, column)] = 50 + column;
      baked.metal.data[at(64, 20, column)] = 150 + column;
    }
    const out = dilateGutter(baked, coverage);
    for (let column = 10; column < 14; column += 1) expect([out.rough.data[at(64, 20, column)], out.metal.data[at(64, 20, column)]]).toEqual([50 + column, 150 + column]);
  });

  it('mask-mode R28 a no-mask island texel holding the start pixel is a source like any other: the gutter beside it gets the start pixel, not a label from across the island', () => {
    const baked = maps(1024, 10, 20);
    const coverage = noCoverage(1024);
    coverage[at(1024, 500, 100)] = 1; // an unmasked island texel: keeps the start pixel 10, 20
    coverage[at(1024, 500, 101)] = 1; // a labelled island texel across it
    baked.rough.data[at(1024, 500, 101)] = 200;
    const out = dilateGutter(baked, coverage);
    expect(out.rough.data[at(1024, 500, 99)]).toBe(10);
    expect(out.rough.data[at(1024, 500, 102)]).toBe(200);
  });

  it('mask-mode R28 beyond reach a gutter texel keeps the pixel the bake gave it', () => {
    const { maps: baked, coverage } = oneIslandTexel(1024, 500, 100);
    baked.rough.data[at(1024, 500, 130)] = 77;
    const out = dilateGutter(baked, coverage);
    expect(out.rough.data[at(1024, 500, 130)]).toBe(77);
  });

  it('mask-mode R28 a stale gutter value within reach is replaced by the island\'s', () => {
    const { maps: baked, coverage } = oneIslandTexel(1024, 500, 100);
    baked.rough.data[at(1024, 500, 105)] = 255; // left by an earlier bake
    baked.metal.data[at(1024, 500, 105)] = 255;
    const out = dilateGutter(baked, coverage);
    expect([out.rough.data[at(1024, 500, 105)], out.metal.data[at(1024, 500, 105)]]).toEqual([200, 90]);
  });

  it('mask-mode R28 equal distances go to the lower row, then the lower column', () => {
    const baked = maps(1024, 10, 20);
    const coverage = noCoverage(1024);
    const island = (row: number, column: number, rough: number): void => {
      coverage[at(1024, row, column)] = 1;
      baked.rough.data[at(1024, row, column)] = rough;
    };
    island(499, 100, 31); // above (500, 100): the lower row
    island(501, 100, 32); // below
    island(700, 99, 33); // left of (700, 100): lower column
    island(700, 101, 34); // right
    const out = dilateGutter(baked, coverage);
    expect(out.rough.data[at(1024, 500, 100)]).toBe(31);
    expect(out.rough.data[at(1024, 700, 100)]).toBe(33);
  });

  it('mask-mode R28 the input maps are not changed and the output planes are new', () => {
    const { maps: baked, coverage } = oneIslandTexel(64, 30, 30);
    const before = [...baked.rough.data];
    const out = dilateGutter(baked, coverage);
    expect([...baked.rough.data]).toEqual(before);
    expect(out.rough.data).not.toBe(baked.rough.data);
    expect(out.metal.data).not.toBe(baked.metal.data);
    expect([out.rough.width, out.rough.height, out.rough.channels]).toEqual([64, 64, 1]);
  });

  it('mask-mode R28 the result is the same every time', () => {
    const { maps: baked, coverage } = oneIslandTexel(1024, 500, 100);
    expect([...dilateGutter(baked, coverage).rough.data]).toEqual([...dilateGutter(baked, coverage).rough.data]);
  });

  it('mask-mode R28 no island at all changes nothing', () => {
    const baked = maps(64, 10, 20);
    const out = dilateGutter(baked, noCoverage(64));
    expect([...out.rough.data]).toEqual([...baked.rough.data]);
  });

  it('mask-mode R28 a coverage of another size is refused', () => {
    expect(() => dilateGutter(maps(64), noCoverage(32))).toThrow();
  });

  it('mask-mode R28 at S = 2048 with a packed layout (islands 100 texels wide, 8 apart) the pass takes at most 200 ms', () => {
    const side = 2048;
    const baked = maps(side, 10, 20);
    const coverage = noCoverage(side);
    for (let top = 8; top + 100 < side; top += 108) {
      for (let left = 8; left + 100 < side; left += 108) {
        for (let row = top; row < top + 100; row += 1) coverage.fill(1, at(side, row, left), at(side, row, left) + 100);
      }
    }
    dilateGutter(baked, coverage); // warm up
    const started = performance.now();
    dilateGutter(baked, coverage);
    expect(performance.now() - started).toBeLessThan(200);
  });
});
