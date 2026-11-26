import { describe, expect, it } from 'vitest';
import { EditDocument } from '../../../src/referenceEditor/document/EditDocument';
import { swapJournal } from '../../../src/referenceEditor/history/TileJournal';
import { tilesAcross, tilesDown, type Rect } from '../../../src/referenceEditor/model/geometry';
import { createRaster } from '../../../src/referenceEditor/model/raster';
import { paintStroke } from '../../../src/referenceEditor/ops/paintStroke';
import { DirtyTiles } from '../../../src/referenceEditor/render/dirtyTiles';
import { cssTransformOf, panBy, zoomAround } from '../../../src/referenceEditor/view/viewMath';

// reference-editor R19 / infrastructure P14, P11, P8: work follows what was touched, not the picture or its bounding box. Counts, not clocks.
const SIZE = 2048;
const RED = 0xff0000ff;

describe('referenceEditor performance counts (R19)', () => {
  it('R19 a diagonal flick repaints about the tiles it touched, not its bounding box', () => {
    const doc = EditDocument.create(createRaster(SIZE, SIZE));
    const journal = doc.beginJournal();
    const dirty = new DirtyTiles(SIZE, SIZE);
    let from = { x: 100, y: 100 };
    for (let step = 1; step <= 36; step += 1) {
      const to = { x: 100 + step * 50, y: 100 + step * 50 };
      const rect = paintStroke(doc.raster, null, { from, to, first: step === 1 }, 48, RED, journal);
      if (rect !== null) dirty.mark(rect);
      from = to;
    }
    const repainted = dirty.drain().reduce((sum: number, r: Rect) => sum + tilesAcross(r.w) * tilesDown(r.h), 0);
    const boundingBoxTiles = tilesAcross(1800) * tilesDown(1800);
    expect(journal.rasterTiles.size).toBeGreaterThan(0);
    expect(repainted).toBeLessThanOrEqual(journal.rasterTiles.size * 4);
    expect(repainted).toBeLessThan(boundingBoxTiles / 4);
  });

  it('R19 undo of a stroke swaps exactly the tiles the stroke touched', () => {
    const doc = EditDocument.create(createRaster(SIZE, SIZE));
    const journal = doc.beginJournal();
    paintStroke(doc.raster, null, { from: { x: 50, y: 50 }, to: { x: 1500, y: 90 }, first: true }, 64, RED, journal);
    const touched = journal.rasterTiles.size;
    const swapped = swapJournal(journal, doc.raster, doc.mask);
    expect(swapped.reduce((sum, r) => sum + tilesAcross(r.w) * tilesDown(r.h), 0)).toBe(touched);
  });

  it('R19 a stroke that stays in one tile journals one tile', () => {
    const doc = EditDocument.create(createRaster(SIZE, SIZE));
    const journal = doc.beginJournal();
    paintStroke(doc.raster, null, { from: { x: 20, y: 20 }, to: { x: 40, y: 30 }, first: true }, 8, RED, journal);
    expect(journal.rasterTiles.size).toBe(1);
  });

  it('R19 zoom and pan only produce a new transform: no pixel is read or written', () => {
    const raster = createRaster(64, 64);
    const before = raster.bytes.slice();
    let view = { scale: 1, x: 0, y: 0 };
    for (let i = 0; i < 1000; i += 1) view = panBy(zoomAround(view, { x: 50, y: 50 }, 1.01), 1, -1);
    expect(cssTransformOf(view)).toMatch(/^translate\(/);
    expect(raster.bytes).toEqual(before);
  });
});
