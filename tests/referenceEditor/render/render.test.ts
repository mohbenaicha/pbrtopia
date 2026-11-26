import { describe, expect, it } from 'vitest';
import { createSelectionMask } from '../../../src/referenceEditor/model/selectionMask';
import { NO_RECORDER } from '../../../src/referenceEditor/model/writeRecorder';
import { selectRect } from '../../../src/referenceEditor/ops/selectRect';
import { DirtyTiles } from '../../../src/referenceEditor/render/dirtyTiles';
import { BAND_ROWS, SELECTION_TINT, bandsOf, fillTint } from '../../../src/referenceEditor/render/selectionOverlay';

const area = (rects: { w: number; h: number }[]): number => rects.reduce((sum, rect) => sum + rect.w * rect.h, 0);

describe('DirtyTiles (reference-editor R19, architecture D7)', () => {
  it('R19 a small rectangle marks only the tiles it touches', () => {
    const tiles = new DirtyTiles(300, 200);
    tiles.mark({ x: 60, y: 10, w: 10, h: 5 }); // crosses the first tile border
    expect(area(tiles.drain())).toBe(2 * 64 * 64);
    expect(tiles.isEmpty).toBe(true);
  });

  it('R19 marking the same tile again does not repaint it twice', () => {
    const tiles = new DirtyTiles(300, 200);
    tiles.mark({ x: 1, y: 1, w: 2, h: 2 });
    tiles.mark({ x: 5, y: 5, w: 2, h: 2 });
    expect(area(tiles.drain())).toBe(64 * 64);
  });

  it('R19 a diagonal flick repaints the touched tiles, not its bounding box', () => {
    const tiles = new DirtyTiles(640, 640);
    for (let k = 0; k < 10; k += 1) tiles.mark({ x: k * 64, y: k * 64, w: 3, h: 3 });
    expect(area(tiles.drain())).toBe(10 * 64 * 64);
  });

  it('R19 marking everything merges into one rectangle of the whole picture, edge tiles clipped', () => {
    const tiles = new DirtyTiles(150, 70);
    tiles.markAll();
    expect(tiles.drain()).toEqual([{ x: 0, y: 0, w: 150, h: 70 }]);
  });

  it('R19 a rectangle outside the picture marks nothing, and resize marks everything at the new size', () => {
    const tiles = new DirtyTiles(100, 100);
    tiles.mark({ x: 500, y: 500, w: 5, h: 5 });
    expect(tiles.isEmpty).toBe(true);
    tiles.resize(30, 20);
    expect(tiles.drain()).toEqual([{ x: 0, y: 0, w: 30, h: 20 }]);
  });
});

describe('selection overlay (reference-editor R8, architecture D8)', () => {
  it('R8 the tint is written for selected pixels only', () => {
    const mask = createSelectionMask(10, 10);
    selectRect(mask, { x: 2, y: 3, w: 3, h: 2 }, NO_RECORDER);
    const out = new Uint32Array(5 * 4);
    fillTint(out, mask, { x: 1, y: 2, w: 5, h: 4 });
    const lit = [...out.keys()].filter((k) => out[k] === SELECTION_TINT).map((k) => [(k % 5) + 1, Math.floor(k / 5) + 2]);
    expect(lit.sort()).toEqual([[2, 3], [2, 4], [3, 3], [3, 4], [4, 3], [4, 4]].sort());
    expect(out.filter((word) => word !== 0 && word !== SELECTION_TINT)).toHaveLength(0);
  });

  it('R19 a tall rectangle is painted in bands of at most 256 rows covering it exactly once', () => {
    const bands = bandsOf({ x: 5, y: 10, w: 100, h: 1000 });
    expect(bands.every((band) => band.h <= BAND_ROWS)).toBe(true);
    expect(area(bands)).toBe(100 * 1000);
    expect(bands[0]!.y).toBe(10);
    expect(bands.at(-1)!.y + bands.at(-1)!.h).toBe(1010);
  });
});
