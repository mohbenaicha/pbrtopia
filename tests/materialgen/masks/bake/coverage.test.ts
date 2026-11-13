import { describe, expect, it } from 'vitest';
import type { PixelImage } from '@mat/imageops';
import { buildCoverage } from '@mat/masks/bake/coverage';

const labelsOf = (rows: number[][]): PixelImage => ({ width: rows[0]!.length, height: rows.length, channels: 1, data: Uint8Array.from(rows.flat()) });
const at = (image: PixelImage, x: number, y: number): number => image.data[y * image.width + x]!;
/** A 16 x 16 picture: label 1 in the left half, label 0 in the right half, label 2 in one corner pixel. */
const halves = (): PixelImage => {
  const rows: number[][] = Array.from({ length: 16 }, () => Array.from({ length: 16 }, (_, x) => (x < 8 ? 1 : 0)));
  rows[15]![15] = 2;
  return labelsOf(rows);
};

describe('materialgen/masks buildCoverage (imageops R79)', () => {
  it('R79 with no label selected there is no coverage (the whole map is edited)', () => {
    expect(buildCoverage({ labels: halves(), selected: [], feather: 2, side: 16 })).toBeNull();
  });

  it('R79 feather 0 is a hard mask: 255 on the selected labels, 0 elsewhere, and several labels add up', () => {
    const one = buildCoverage({ labels: halves(), selected: [1], feather: 0, side: 16 })!;
    expect(at(one, 0, 0)).toBe(255);
    expect(at(one, 12, 0)).toBe(0);
    const two = buildCoverage({ labels: halves(), selected: [1, 2], feather: 0, side: 16 })!;
    expect(at(two, 15, 15)).toBe(255);
    expect(at(two, 0, 3)).toBe(255);
    expect(at(two, 12, 3)).toBe(0);
  });

  it('R79 a feather fades the border over its radius and leaves the far inside and far outside untouched', () => {
    const soft = buildCoverage({ labels: halves(), selected: [1], feather: 2, side: 16 })!;
    expect(at(soft, 7, 4)).toBeGreaterThan(0);
    expect(at(soft, 7, 4)).toBeLessThan(255); // on the border
    expect(at(soft, 8, 4)).toBeGreaterThan(0);
    expect(at(soft, 8, 4)).toBeLessThan(255);
    expect(at(soft, 3, 4)).toBe(255);
    expect(at(soft, 12, 4)).toBe(0);
  });

  it('R79 the coverage is at the asked side: a smaller side takes the labels at their nearest pixels and scales the feather', () => {
    const half = buildCoverage({ labels: halves(), selected: [1], feather: 0, side: 8 })!;
    expect(half.width).toBe(8);
    expect(half.height).toBe(8);
    expect(at(half, 0, 0)).toBe(255);
    expect(at(half, 3, 0)).toBe(255);
    expect(at(half, 4, 0)).toBe(0);
    const full = buildCoverage({ labels: halves(), selected: [1], feather: 4, side: 16 })!;
    const scaled = buildCoverage({ labels: halves(), selected: [1], feather: 4, side: 8 })!; // radius 4 x 8/16 = 2
    expect(at(full, 7, 4)).toBeGreaterThan(0);
    expect(at(scaled, 3, 2)).toBeGreaterThan(0);
    expect(at(scaled, 3, 2)).toBeLessThan(255);
  });
});
