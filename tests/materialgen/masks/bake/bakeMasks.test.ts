import { describe, expect, it } from 'vitest';
import { bakeMasks } from '@mat/masks/bake/bakeMasks';
import type { PixelImage } from '@mat/imageops';

function labelsOf(rows: number[][]): PixelImage {
  return { width: rows[0]!.length, height: rows.length, channels: 1, data: Uint8Array.from(rows.flat()) };
}
const at = (image: PixelImage, x: number, y: number): number => image.data[y * image.width + x]!;
const rows = (...values: Array<[number, number]>) => values.map(([rough, metal]) => ({ rough, metal }));

describe('materialgen/masks bakeMasks', () => {
  it('R42 the outputs are R8 maps of the labels\' size, one for roughness and one for metal', () => {
    const { rough, metal } = bakeMasks({ labels: labelsOf([[0, 1], [1, 0]]), rows: rows([0.2, 0], [0.8, 1]), feather: 0 });
    for (const map of [rough, metal]) expect([map.width, map.height, map.channels]).toEqual([2, 2, 1]);
  });

  it('R43 without feather each pixel is its label\'s table value times 255, rounded to the nearest integer', () => {
    const { rough, metal } = bakeMasks({ labels: labelsOf([[0, 1, 2]]), rows: rows([0.2, 0], [0.9, 1], [0.5, 0.333]), feather: 0 });
    expect(Array.from(rough.data)).toEqual([51, 230, 128]);
    expect(Array.from(metal.data)).toEqual([0, 255, 85]);
  });

  it('R42 a label with no row takes the first row\'s values instead of reading past the table', () => {
    const { rough } = bakeMasks({ labels: labelsOf([[0, 5]]), rows: rows([0.2, 0]), feather: 0 });
    expect(Array.from(rough.data)).toEqual([51, 51]);
  });

  it('R44 feather 2 blends the boundary strictly between the two values and leaves pixels farther than 2 exact', () => {
    const line = [0, 0, 0, 0, 0, 0, 0, 0, 1, 1, 1, 1, 1, 1, 1, 1];
    const { rough } = bakeMasks({ labels: labelsOf(Array.from({ length: 16 }, () => line)), rows: rows([0.2, 0], [0.8, 0]), feather: 2 });
    const row = Array.from({ length: 16 }, (_, x) => at(rough, x, 8));
    // the boundaries are 7|8 and, over the seam, 15|0: columns 2-5 and 10-13 are 3 or more pixels from the other value
    expect(row.slice(2, 6)).toEqual([51, 51, 51, 51]);
    expect(row.slice(10, 14)).toEqual([204, 204, 204, 204]);
    for (const x of [6, 7, 8, 9, 14, 15, 0, 1]) {
      expect(row[x], `column ${x}`).toBeGreaterThan(51);
      expect(row[x], `column ${x}`).toBeLessThan(204);
    }
  });

  it('R44 feather 0 is exactly R43', () => {
    const labels = labelsOf([[0, 1, 0], [1, 0, 1]]);
    const plain = bakeMasks({ labels, rows: rows([0.2, 0], [0.8, 1]), feather: 0 });
    expect(Array.from(plain.rough.data)).toEqual([51, 204, 51, 204, 51, 204]);
  });

  it('R44 a boundary across the left and right seam blends like an interior one', () => {
    const size = 16;
    const interior = labelsOf(Array.from({ length: size }, () => Array.from({ length: size }, (_, x) => (x >= 4 && x < 12 ? 1 : 0)))); // value 1 in the middle: boundaries 3|4 and 11|12
    const crossing = labelsOf(Array.from({ length: size }, () => Array.from({ length: size }, (_, x) => (x >= 12 || x < 4 ? 1 : 0)))); // the same picture moved 8 pixels: a block that crosses the seam
    const table = rows([0.2, 0], [0.8, 0]);
    const reference = bakeMasks({ labels: interior, rows: table, feather: 1 }).rough;
    const wrapped = bakeMasks({ labels: crossing, rows: table, feather: 1 }).rough;
    for (let x = 0; x < size; x += 1) expect(at(wrapped, x, 3)).toBe(at(reference, (x + 8) % size, 3));
  });

  it('R44 the feather applies to the metal map as well', () => {
    const labels = labelsOf(Array.from({ length: 8 }, () => [0, 0, 0, 0, 1, 1, 1, 1]));
    const { metal } = bakeMasks({ labels, rows: rows([0.5, 0], [0.5, 1]), feather: 1 });
    expect(at(metal, 3, 4)).toBeGreaterThan(0);
    expect(at(metal, 3, 4)).toBeLessThan(255);
    expect(at(metal, 1, 4)).toBe(0); // column 0 is next to the seam, where the 1 region wraps round
  });

  it('R46 the same inputs give the same maps', () => {
    const labels = labelsOf(Array.from({ length: 12 }, (_, y) => Array.from({ length: 12 }, (_, x) => (x * 7 + y * 3) % 3)));
    const input = { labels, rows: rows([0.1, 0], [0.5, 0.5], [0.9, 1]), feather: 3 };
    expect(Array.from(bakeMasks(input).rough.data)).toEqual(Array.from(bakeMasks(input).rough.data));
  });

  it('R44 the feather is kept to 0 to 4 and a whole number', () => {
    const labels = labelsOf([[0, 1, 0, 1]]);
    const same = bakeMasks({ labels, rows: rows([0.2, 0], [0.8, 0]), feather: 4 });
    const over = bakeMasks({ labels, rows: rows([0.2, 0], [0.8, 0]), feather: 9 });
    expect(Array.from(over.rough.data)).toEqual(Array.from(same.rough.data));
  });
});
