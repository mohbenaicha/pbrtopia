import { describe, expect, it } from 'vitest';
import { flipRows } from '../../../../src/materialgen/compositing/gpu/rawGl';

describe('materialgen/compositing read-back row order (R22)', () => {
  it('R22 rows are reversed as whole rows, and the call is its own inverse', () => {
    const square = Uint8Array.from([1, 2, 3, 4, 5, 6, 7, 8]); // side 2, 2 channels: rows [1 2 3 4] and [5 6 7 8]
    expect(Array.from(flipRows(square, 2, 2))).toEqual([5, 6, 7, 8, 1, 2, 3, 4]);
    expect(Array.from(flipRows(flipRows(square, 2, 2), 2, 2))).toEqual(Array.from(square));
  });

  it('R22 a one-row picture and an odd number of rows keep the middle row', () => {
    expect(Array.from(flipRows(Uint8Array.from([7, 8]), 1, 2))).toEqual([7, 8]);
    expect(Array.from(flipRows(Uint8Array.from([1, 2, 3, 4, 5, 6, 7, 8, 9]), 3, 1))).toEqual([7, 8, 9, 4, 5, 6, 1, 2, 3]);
  });
});
