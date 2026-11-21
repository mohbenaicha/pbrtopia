import { describe, expect, it } from 'vitest';
import { majorityFilter } from '@shared/materialMasks/quantise/labelCleanup';

const grid = (rows: number[][]): { labels: Uint8Array; size: number } => ({ labels: Uint8Array.from(rows.flat()), size: rows.length });
const at = (labels: Uint8Array, size: number, x: number, y: number): number => labels[y * size + x]!;

describe('materialgen/masks labelCleanup', () => {
  it('R20 a pixel takes the most frequent label in its 3 x 3 window', () => {
    const { labels, size } = grid([
      [0, 0, 0, 0],
      [0, 1, 0, 0],
      [0, 0, 0, 0],
      [0, 0, 0, 0],
    ]);
    expect(at(majorityFilter(labels, size, 2), size, 1, 1)).toBe(0);
  });

  it('R20 its own label wins a tie, and another tie goes to the lowest label', () => {
    const { labels, size } = grid([
      [0, 0, 0],
      [1, 1, 1],
      [2, 2, 2],
    ]);
    const filtered = majorityFilter(labels, size, 3);
    expect(at(filtered, size, 1, 1)).toBe(1); // three of each label, its own wins
    const other = grid([
      [0, 0, 0],
      [1, 2, 2],
      [1, 1, 2],
    ]);
    expect(at(majorityFilter(other.labels, other.size, 3), other.size, 0, 1)).toBe(1); // wrapped window: 1 x4 (own), 2 x3... own count is the most
  });

  it('R20 the window wraps at the edges, so a left-edge pixel counts the right-edge pixels', () => {
    const ones = new Set(['0,2', '0,4', '7,2', '7,3', '7,4']);
    const { labels, size } = grid(Array.from({ length: 8 }, (_, y) => Array.from({ length: 8 }, (_, x) => (ones.has(`${x},${y}`) ? 1 : 0))));
    // (0,3) is 0; its window holds 5 ones (two on column 0, three on column 7 over the seam) and 4 zeros
    expect(at(majorityFilter(labels, size, 2), size, 0, 3)).toBe(1);
  });

  it('R23 the filter reads the labels as they were, not as it changes them', () => {
    const { labels, size } = grid([
      [0, 1, 0, 1],
      [1, 0, 1, 0],
      [0, 1, 0, 1],
      [1, 0, 1, 0],
    ]);
    const before = Uint8Array.from(labels);
    majorityFilter(labels, size, 2);
    expect(Array.from(labels)).toEqual(Array.from(before));
  });
});

describe('material-masks-core labelCleanup edges', () => {
  // The five cells of the last row and column are label 1; the other four are label 0. The corner (0, 0) sees all nine cells when the window wraps.
  const { labels, size } = grid([
    [0, 0, 1],
    [0, 0, 1],
    [1, 1, 1],
  ]);

  it('material-masks-core R5 wrap (the default) lets a corner pixel count the pixels on the far sides', () => {
    expect(at(majorityFilter(labels, size, 2), size, 0, 0)).toBe(1);
    expect(at(majorityFilter(labels, size, 2, 'wrap'), size, 0, 0)).toBe(1);
  });

  it('material-masks-core R5 clamp: a corner pixel counts only cells inside the picture, so the far side does not reach it', () => {
    expect(at(majorityFilter(labels, size, 2, 'clamp'), size, 0, 0)).toBe(0);
  });

  it('material-masks-core R5 clamp leaves a picture of one flat label unchanged', () => {
    const flat = Uint8Array.from({ length: 16 }, () => 3);
    expect(Array.from(majorityFilter(flat, 4, 4, 'clamp'))).toEqual(Array.from(flat));
  });
});
