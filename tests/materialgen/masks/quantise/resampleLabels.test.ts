import { describe, expect, it } from 'vitest';
import type { PixelImage } from '@mat/workerapi';
import { resampleLabelsToSide } from '@mat/masks/quantise/resampleLabels';

const grid = (side: number, valueAt: (x: number, y: number) => number): PixelImage => {
  const data = new Uint8Array(side * side);
  for (let y = 0; y < side; y += 1) for (let x = 0; x < side; x += 1) data[y * side + x] = valueAt(x, y);
  return { width: side, height: side, channels: 1, data };
};

describe('materialgen/masks resampleLabelsToSide', () => {
  it('R79 labels taken to a larger size keep their label numbers, never a blend of two', () => {
    const big = resampleLabelsToSide(grid(2, (x) => x * 5), 4);
    expect([big.width, big.height]).toEqual([4, 4]);
    expect(Array.from(big.data.slice(0, 4))).toEqual([0, 0, 5, 5]);
    expect(new Set(big.data)).toEqual(new Set([0, 5]));
  });

  it('R79 labels taken to a smaller size pick one of the labels under each new pixel', () => {
    const small = resampleLabelsToSide(grid(4, (x) => (x < 2 ? 3 : 7)), 2);
    expect(Array.from(small.data)).toEqual([3, 7, 3, 7]);
  });

  it('R79 labels already at the size come back as they are', () => {
    const same = grid(4, (x, y) => x + y);
    expect(resampleLabelsToSide(same, 4)).toBe(same);
  });
});
