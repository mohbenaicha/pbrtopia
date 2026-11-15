import { describe, expect, it } from 'vitest';
import { MAX_TILED_SIDE, bakedTilingOf, tilingBlockReason } from '@mat/export/plan/exportTiling';

describe('materialgen/export R48 the limit of a tiled picture', () => {
  it('R48 a tiled side is at most 8192 pixels', () => {
    expect(MAX_TILED_SIDE).toBe(8192);
  });

  it('R48 a size and tiling that fit have no reason to be blocked, in either direction', () => {
    expect(tilingBlockReason(2048, 4, 4)).toBeNull(); // exactly 8192
    expect(tilingBlockReason(1024, 8, 1)).toBeNull();
    expect(tilingBlockReason(2048, 5, 1)).toBe('Too large: lower the size or the tiling.');
    expect(tilingBlockReason(1024, 1, 9)).toBe('Too large: lower the size or the tiling.');
  });
});

describe('materialgen/export R45 R46 R47 which tiling is baked', () => {
  it('R46 nothing is baked when the switch is off, when the tiling is 1 x 1, or when it does not fit', () => {
    expect(bakedTilingOf({ on: false, size: 1024, x: 2, y: 2 })).toBeNull();
    expect(bakedTilingOf({ on: true, size: 1024, x: 1, y: 1 })).toBeNull();
    expect(bakedTilingOf({ on: true, size: 2048, x: 5, y: 1 })).toBeNull();
  });

  it('R46 the project tiling is baked as it is when the switch is on and it fits', () => {
    expect(bakedTilingOf({ on: true, size: 1024, x: 2, y: 1 })).toEqual({ x: 2, y: 1 });
    expect(bakedTilingOf({ on: true, size: 512, x: 1, y: 3 })).toEqual({ x: 1, y: 3 });
  });
});
