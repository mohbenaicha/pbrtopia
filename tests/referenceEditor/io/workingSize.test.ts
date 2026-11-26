import { describe, expect, it } from 'vitest';
import { MAX_WORKING_SIDE, workingSize } from '../../../src/referenceEditor/io/decodeToRaster';

describe('workingSize (reference-editor R4, architecture D10)', () => {
  it('R4 a picture within 4096 px keeps its size', () => {
    expect(workingSize(800, 600)).toEqual({ width: 800, height: 600 });
    expect(workingSize(4096, 4096)).toEqual({ width: 4096, height: 4096 });
  });

  it('R4 a larger picture is scaled so its longest side is 4096, aspect kept', () => {
    expect(MAX_WORKING_SIDE).toBe(4096);
    expect(workingSize(8192, 4096)).toEqual({ width: 4096, height: 2048 });
    expect(workingSize(3000, 12000)).toEqual({ width: 1024, height: 4096 });
  });

  it('R4 a very thin picture never reaches 0 px', () => {
    expect(workingSize(100000, 3).height).toBe(1);
  });
});
