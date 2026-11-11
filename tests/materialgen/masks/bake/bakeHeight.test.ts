import { describe, expect, it } from 'vitest';
import { HEIGHT_SENSITIVITY, bakeHeight } from '@mat/masks/bake/bakeHeight';
import type { PixelImage } from '@mat/imageops';

const labelsOf = (rows: number[][]): PixelImage => ({ width: rows[0]!.length, height: rows.length, channels: 1, data: Uint8Array.from(rows.flat()) });
const grey = (width: number, height: number, value: number): PixelImage => ({ width, height, channels: 1, data: new Uint8Array(width * height).fill(value) });
const at = (image: PixelImage, x: number, y: number): number => image.data[y * image.width + x]!;

describe('materialgen/masks bakeHeight (masks R82)', () => {
  it('R82 the sensitivity is 0.25: offset +1 raises by 64 and -1 lowers by 64, clamped to 0..255', () => {
    expect(HEIGHT_SENSITIVITY).toBe(0.25);
    const labels = labelsOf([[0, 1, 2]]);
    expect(Array.from(bakeHeight({ labels, offsets: [1, -1, 0], feather: 0, base: grey(3, 1, 128) }).data)).toEqual([192, 64, 128]);
    expect(Array.from(bakeHeight({ labels, offsets: [1, -1, 0], feather: 0, base: grey(3, 1, 250) }).data)).toEqual([255, 186, 250]);
    expect(Array.from(bakeHeight({ labels, offsets: [1, -1, 0], feather: 0, base: grey(3, 1, 10) }).data)).toEqual([74, 0, 10]);
  });

  it('R82 the detail of the base inside a region is kept: the offset is added to each base pixel', () => {
    const base: PixelImage = { width: 3, height: 1, channels: 1, data: Uint8Array.from([10, 100, 200]) };
    expect(Array.from(bakeHeight({ labels: labelsOf([[0, 0, 0]]), offsets: [0.5], feather: 0, base }).data)).toEqual([42, 132, 232]);
  });

  it('R82 a label with no offset uses the first, and the result has the labels size', () => {
    const out = bakeHeight({ labels: labelsOf([[0, 5]]), offsets: [1], feather: 0, base: grey(2, 1, 100) });
    expect([out.width, out.height, out.channels]).toEqual([2, 1, 1]);
    expect(Array.from(out.data)).toEqual([164, 164]);
  });

  it('R82 the feather blurs the offsets, not the result: far from a boundary the base plus the exact offset, on it a value strictly between', () => {
    const line = [0, 0, 0, 0, 0, 0, 0, 0, 1, 1, 1, 1, 1, 1, 1, 1];
    const labels = labelsOf(Array.from({ length: 16 }, () => line));
    const out = bakeHeight({ labels, offsets: [0, 1], feather: 2, base: grey(16, 16, 100) });
    const row = Array.from({ length: 16 }, (_, x) => at(out, x, 8));
    expect(row.slice(2, 6)).toEqual([100, 100, 100, 100]);
    expect(row.slice(10, 14)).toEqual([164, 164, 164, 164]);
    for (const x of [7, 8]) {
      expect(row[x]).toBeGreaterThan(100);
      expect(row[x]).toBeLessThan(164);
    }
  });

  it('R82 R46 equal inputs give equal output', () => {
    const input = { labels: labelsOf([[0, 1], [1, 0]]), offsets: [0.3, -0.7], feather: 1, base: grey(2, 2, 90) };
    expect(Array.from(bakeHeight(input).data)).toEqual(Array.from(bakeHeight(input).data));
  });
});
