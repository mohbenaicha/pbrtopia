import { describe, expect, it } from 'vitest';
import { loadMaterialVectorsFrom } from '../../../../../src/materialgen/app/panels/masks/loadMaterialVectors';

const halfBytes = (...values: number[]): Uint8Array => Uint8Array.from(values.flatMap((half) => [half & 0xff, half >> 8]));
// 1.0 = 0x3C00, 2.0 = 0x4000, 0.5 = 0x3800, 0 = 0
const TWO_MATERIALS = halfBytes(0x3c00, 0x4000, 0x3800, 0);
const serve = (bytes: Uint8Array) => async () => bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer;

describe('materialgen/app loadMaterialVectorsFrom (masks R75)', () => {
  it('R75 reads the one vectors file into a vector per material', async () => {
    const vectors = await loadMaterialVectorsFrom({ '/data/material-vectors.bin': async () => 'blob:vectors' }, 2, 2, serve(TWO_MATERIALS));
    expect(vectors.map((vector) => Array.from(vector))).toEqual([[1, 2], [0.5, 0]]);
  });

  it('R75 R77 a missing file is a failure the matching answers with the keyword match', async () => {
    await expect(loadMaterialVectorsFrom({}, 2, 2, serve(TWO_MATERIALS))).rejects.toThrow();
  });

  it('R75 R77 a file of the wrong length (not one vector per material) is refused', async () => {
    await expect(loadMaterialVectorsFrom({ '/data/material-vectors.bin': async () => 'blob:vectors' }, 3, 2, serve(TWO_MATERIALS))).rejects.toThrow();
  });
});
