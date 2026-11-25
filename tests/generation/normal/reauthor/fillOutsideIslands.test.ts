import { describe, expect, it } from 'vitest';
import { fillOutsideIslands } from '../../../../src/generation/normal/reauthor/fillOutsideIslands';

function picture(side: number, paint: (column: number, row: number) => [number, number, number, number]): Uint8ClampedArray {
  const data = new Uint8ClampedArray(side * side * 4);
  for (let row = 0; row < side; row += 1) for (let column = 0; column < side; column += 1) data.set(paint(column, row), (row * side + column) * 4);
  return data;
}
const at = (data: Uint8ClampedArray, side: number, column: number, row: number): number[] => Array.from(data.slice((row * side + column) * 4, (row * side + column) * 4 + 4));

describe('fillOutsideIslands', () => {
  // an 8 x 8 picture whose covered texels are columns 0..3; every covered texel is coloured by its row
  const side = 8;
  const covered = (): Uint8Array => Uint8Array.from({ length: 64 }, (_, index) => (index % 8 <= 3 ? 1 : 0));
  const painted = (): Uint8ClampedArray => picture(side, (column, row) => (column <= 3 ? [100 + row, 90, 255, 255] : [1, 2, 3, 4]));

  it('normal-reauthor R8 an uncovered texel within the reach copies its nearest covered texel', () => {
    const data = painted();
    fillOutsideIslands(data, covered(), side, 2);
    expect(at(data, side, 4, 3)).toEqual([103, 90, 255, 255]);
    expect(at(data, side, 5, 6)).toEqual([106, 90, 255, 255]);
  });

  it('normal-reauthor R8 an uncovered texel beyond the reach becomes exactly flat (128, 128, 255, 255)', () => {
    const data = painted();
    fillOutsideIslands(data, covered(), side, 2);
    expect(at(data, side, 6, 3)).toEqual([128, 128, 255, 255]);
    expect(at(data, side, 7, 0)).toEqual([128, 128, 255, 255]);
  });

  it('normal-reauthor R8 covered texels are never changed', () => {
    const data = painted();
    const before = Array.from(data);
    fillOutsideIslands(data, covered(), side, 3);
    for (let row = 0; row < side; row += 1) for (let column = 0; column <= 3; column += 1) expect(at(data, side, column, row)).toEqual(before.slice((row * side + column) * 4, (row * side + column) * 4 + 4));
  });

  it('normal-reauthor R8 equidistant sources: the lower row wins, then the lower column', () => {
    const only = (...cells: [number, number][]): Uint8Array => {
      const coverage = new Uint8Array(64);
      for (const [column, row] of cells) coverage[row * side + column] = 1;
      return coverage;
    };
    const colour = (column: number, row: number): [number, number, number, number] => [10 * column, 10 * row, 255, 255];
    const rows = picture(side, colour);
    fillOutsideIslands(rows, only([2, 1], [2, 3]), side, 1); // the texel (2, 2) has covered texels above and below it
    expect(at(rows, side, 2, 2)).toEqual([20, 10, 255, 255]);
    const columns = picture(side, colour);
    fillOutsideIslands(columns, only([1, 2], [3, 2]), side, 1); // and here on its left and right
    expect(at(columns, side, 2, 2)).toEqual([10, 20, 255, 255]);
  });

  it('normal-reauthor R8 the nearest is by Euclidean distance, not by rings of a square', () => {
    const coverage = new Uint8Array(64);
    coverage[0 * side + 5] = 1; // distance from (2, 2): sqrt(9 + 4) = 3.61
    coverage[4 * side + 4] = 1; // distance from (2, 2): sqrt(4 + 4) = 2.83
    const data = picture(side, (column, row) => [column * 10, row * 10, 255, 255]);
    fillOutsideIslands(data, coverage, side, 4);
    expect(at(data, side, 2, 2)).toEqual([40, 40, 255, 255]);
  });

  it('normal-reauthor R8 a picture with no covered texel becomes flat everywhere', () => {
    const data = painted();
    fillOutsideIslands(data, new Uint8Array(64), side, 4);
    for (let index = 0; index < 64; index += 1) expect(at(data, side, index % 8, Math.floor(index / 8))).toEqual([128, 128, 255, 255]);
  });
});
