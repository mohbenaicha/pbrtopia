import { describe, expect, it } from 'vitest';
import { tilingBakeState } from '../../../../src/materialgen/imageops/geometry/tilingBake';

describe('imageops tiling bake (R37)', () => {
  it('R37 whole-number tiling above 1 is allowed', () => {
    expect(tilingBakeState({ tx: 2, ty: 3, ox: 0, oy: 0 })).toEqual({ enabled: true });
  });

  it('R37 fractional tiling is refused with "Set whole-number tiling"', () => {
    expect(tilingBakeState({ tx: 1.5, ty: 2, ox: 0, oy: 0 })).toEqual({ enabled: false, reason: 'Set whole-number tiling' });
    expect(tilingBakeState({ tx: 2, ty: 2.25, ox: 0, oy: 0 })).toEqual({ enabled: false, reason: 'Set whole-number tiling' });
  });

  it('R37 1 x 1 with no offset is refused because nothing would change', () => {
    expect(tilingBakeState({ tx: 1, ty: 1, ox: 0, oy: 0 }).enabled).toBe(false);
  });

  it('R37 1 x 1 with an offset is allowed (the bake rolls the picture)', () => {
    expect(tilingBakeState({ tx: 1, ty: 1, ox: 0.25, oy: 0 })).toEqual({ enabled: true });
  });

  it('R37 tiling outside 1 to 10 is refused', () => {
    expect(tilingBakeState({ tx: 11, ty: 1, ox: 0, oy: 0 }).enabled).toBe(false);
    expect(tilingBakeState({ tx: 0, ty: 1, ox: 0, oy: 0 }).enabled).toBe(false);
  });
});
