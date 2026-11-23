import { describe, expect, it } from 'vitest';
import { NONE_LABEL, bakeMasks, type PixelImage } from '../../../src/materialMasks';

const SIZE = 4;
const grey = (bytes: number[]): PixelImage => ({ width: SIZE, height: SIZE, channels: 1, data: Uint8Array.from(bytes) });
const filled = (value: number): PixelImage => grey(new Array(SIZE * SIZE).fill(value));
const labels = (rows: number[]): PixelImage => grey(rows);
const ROWS = [{ rough: 0.2, metal: 1 }, { rough: 0.8, metal: 0 }];
const byte = (unit: number) => Math.round(unit * 255);

describe('bakeMasks with a base image: a no-mask texel is not written (mask-mode R14)', () => {
  it('mask-mode R14 a labelled texel takes the table value and a 255 texel keeps the base pixel in both maps', () => {
    const L = labels([0, 0, NONE_LABEL, NONE_LABEL, 1, 1, NONE_LABEL, NONE_LABEL, ...new Array(8).fill(NONE_LABEL)]);
    const { rough, metal } = bakeMasks({ labels: L, rows: ROWS, feather: 0, edges: 'clamp', base: { rough: filled(77), metal: filled(33) } });
    expect(rough.data[0]).toBe(byte(0.2));
    expect(rough.data[4]).toBe(byte(0.8));
    expect(rough.data[2]).toBe(77);
    expect(metal.data[2]).toBe(33);
    expect(metal.data[0]).toBe(byte(1));
    expect(rough.data[15]).toBe(77);
  });

  it('mask-mode R14 a keep texel (under a hidden triangle) keeps the base pixel even when it has a label', () => {
    const L = labels(new Array(SIZE * SIZE).fill(0));
    const keep = new Uint8Array(SIZE * SIZE);
    keep[5] = 1;
    const { rough } = bakeMasks({ labels: L, rows: ROWS, feather: 0, edges: 'clamp', base: { rough: filled(90), metal: filled(10) }, keep });
    expect(rough.data[5]).toBe(90);
    expect(rough.data[4]).toBe(byte(0.2));
  });

  it('mask-mode R14 the feather never pulls a no-mask neighbour into a labelled texel and never smears the base', () => {
    const L = labels([0, 0, 0, 0, 0, 0, 0, 0, ...new Array(8).fill(NONE_LABEL)]);
    const { rough } = bakeMasks({ labels: L, rows: ROWS, feather: 2, edges: 'clamp', base: { rough: filled(200), metal: filled(200) } });
    for (let i = 0; i < 8; i += 1) expect(rough.data[i]).toBe(byte(0.2)); // a region of one label stays exactly that value
    for (let i = 8; i < 16; i += 1) expect(rough.data[i]).toBe(200); // base untouched
  });

  it('mask-mode R14 the feather still blends two labels across their border', () => {
    const L = labels([0, 0, 1, 1, 0, 0, 1, 1, 0, 0, 1, 1, 0, 0, 1, 1]);
    const { rough } = bakeMasks({ labels: L, rows: ROWS, feather: 1, edges: 'clamp', base: { rough: filled(0), metal: filled(0) } });
    expect(rough.data[1]).toBeGreaterThan(byte(0.2));
    expect(rough.data[1]).toBeLessThan(byte(0.8));
  });

  it('mask-mode R14 without a base the maps are as before for labelled texels (all labels set)', () => {
    const L = labels(new Array(SIZE * SIZE).fill(1));
    const { rough, metal } = bakeMasks({ labels: L, rows: ROWS, feather: 0, edges: 'clamp' });
    expect(rough.data.every((v) => v === byte(0.8))).toBe(true);
    expect(metal.data.every((v) => v === 0)).toBe(true);
  });

  it('mask-mode R14 editing a row (a new rows table) leaves every no-mask texel at the base value', () => {
    const L = labels([0, NONE_LABEL, 1, NONE_LABEL, ...new Array(12).fill(NONE_LABEL)]);
    const base = { rough: filled(123), metal: filled(45) };
    const before = bakeMasks({ labels: L, rows: ROWS, feather: 1, edges: 'clamp', base });
    const after = bakeMasks({ labels: L, rows: [{ rough: 0.5, metal: 0.5 }, { rough: 0.9, metal: 0.1 }], feather: 3, edges: 'clamp', base });
    for (let i = 0; i < 16; i += 1) {
      if (L.data[i] === NONE_LABEL) {
        expect(before.rough.data[i]).toBe(123);
        expect(after.rough.data[i]).toBe(123);
        expect(after.metal.data[i]).toBe(45);
      }
    }
  });

  it('mask-mode R14 a label up to 31 reads its own row of a 32-row table', () => {
    const rows = Array.from({ length: 32 }, (_, k) => ({ rough: k / 31, metal: 0 }));
    const L = labels(new Array(SIZE * SIZE).fill(31));
    const { rough } = bakeMasks({ labels: L, rows, feather: 0, edges: 'clamp', base: { rough: filled(0), metal: filled(0) } });
    expect(rough.data[0]).toBe(255);
  });
});
