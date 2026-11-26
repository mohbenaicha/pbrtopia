import { describe, expect, it } from 'vitest';
import { createRaster } from '../../../src/referenceEditor/model/raster';
import { hasSelection } from '../../../src/referenceEditor/model/selectionMask';
import { packColour } from '../../../src/referenceEditor/model/packColour';
import { EditDocument } from '../../../src/referenceEditor/document/EditDocument';
import { paintStroke } from '../../../src/referenceEditor/ops/paintStroke';
import { selectRect } from '../../../src/referenceEditor/ops/selectRect';
import { selectStroke } from '../../../src/referenceEditor/ops/selectStroke';

const W = 200; // 4 tile columns of 64, so strokes touch several tiles
const H = 150;
const RED = packColour('#ff0000');
const seg = (x0: number, y0: number, x1: number, y1: number, first = true) => ({ from: { x: x0, y: y0 }, to: { x: x1, y: y1 }, first });

function paint(doc: EditDocument, segment: ReturnType<typeof seg>, size = 9): void {
  const journal = doc.beginJournal();
  paintStroke(doc.raster, doc.hasSelection ? doc.mask : null, segment, size, RED, journal);
  doc.push({ kind: 'tiles', journal, changesPixels: true });
}
function select(doc: EditDocument, x: number, y: number, w: number, h: number): void {
  const journal = doc.beginJournal();
  selectRect(doc.mask, { x, y, w, h }, journal);
  doc.push({ kind: 'tiles', journal, changesPixels: false });
}
const snapshot = (doc: EditDocument): string => `${doc.raster.width}x${doc.raster.height}:${doc.raster.words.join(',')}`;
const maskSnapshot = (doc: EditDocument): string => doc.mask.cells.join('');

describe('EditDocument undo and redo (reference-editor R14)', () => {
  it('R14 undo restores the exact pixels of a stroke and redo reapplies them', () => {
    const doc = EditDocument.create(createRaster(W, H));
    const blank = snapshot(doc);
    paint(doc, seg(10, 10, 190, 140));
    const painted = snapshot(doc);
    expect(painted).not.toBe(blank);
    expect(doc.undo()).not.toBeNull();
    expect(snapshot(doc)).toBe(blank);
    expect(doc.redo()).not.toBeNull();
    expect(snapshot(doc)).toBe(painted);
  });

  it('R14 a stroke journal copies each touched tile once, however many segments cross it', () => {
    const doc = EditDocument.create(createRaster(W, H));
    const journal = doc.beginJournal();
    for (let k = 0; k < 20; k += 1) paintStroke(doc.raster, null, seg(5 + k, 5, 6 + k, 5, k === 0), 5, RED, journal);
    expect(journal.rasterTiles.size).toBe(1); // all inside tile (0, 0)
  });

  it('R14 undo and redo of a stroke allocate no new tile buffers', () => {
    const doc = EditDocument.create(createRaster(W, H));
    const journal = doc.beginJournal();
    paintStroke(doc.raster, null, seg(10, 10, 190, 140), 9, RED, journal);
    doc.push({ kind: 'tiles', journal, changesPixels: true });
    const buffers = [...journal.rasterTiles.values()];
    doc.undo();
    doc.redo();
    expect([...journal.rasterTiles.values()]).toEqual(buffers);
    expect([...journal.rasterTiles.values()].every((tile, k) => tile === buffers[k])).toBe(true);
  });

  it('R14 undo walks steps in reverse order, selection changes included', () => {
    const doc = EditDocument.create(createRaster(W, H));
    select(doc, 20, 20, 50, 50);
    paint(doc, seg(25, 25, 60, 60));
    const afterPaint = snapshot(doc);
    doc.undo();
    expect(snapshot(doc)).not.toBe(afterPaint);
    expect(hasSelection(doc.mask)).toBe(true);
    doc.undo();
    expect(hasSelection(doc.mask)).toBe(false);
    expect(doc.undo()).toBeNull();
  });

  it('R14 a new step after an undo drops the undone steps', () => {
    const doc = EditDocument.create(createRaster(W, H));
    paint(doc, seg(10, 10, 50, 50));
    doc.undo();
    paint(doc, seg(100, 100, 120, 120));
    expect(doc.redo()).toBeNull();
  });

  it('R14 invert is undone and redone with the exact cells and bounds', () => {
    const doc = EditDocument.create(createRaster(W, H));
    select(doc, 30, 30, 20, 20);
    const before = maskSnapshot(doc);
    const boundsBefore = { ...doc.mask.bounds };
    doc.invert();
    expect(maskSnapshot(doc)).not.toBe(before);
    doc.undo();
    expect(maskSnapshot(doc)).toBe(before);
    expect(doc.mask.bounds).toEqual(boundsBefore);
    doc.redo();
    expect(hasSelection(doc.mask)).toBe(true);
  });

  it('R14 crop changes the size, flags a relayout, and undo and redo swap the pictures back and forth', () => {
    const doc = EditDocument.create(createRaster(W, H, 0xff808080));
    select(doc, 40, 30, 60, 50);
    const original = doc.raster;
    doc.crop(RED);
    expect([doc.raster.width, doc.raster.height]).toEqual([60, 50]);
    expect(hasSelection(doc.mask)).toBe(false);
    const cropped = doc.raster;
    const undone = doc.undo();
    expect(undone?.relayout).toBe(true);
    expect(doc.raster).toBe(original);
    expect(hasSelection(doc.mask)).toBe(true);
    const redone = doc.redo();
    expect(redone?.relayout).toBe(true);
    expect(doc.raster).toBe(cropped);
  });

  it('R14 clearing the selection is one step and undo brings the selection back', () => {
    const doc = EditDocument.create(createRaster(W, H));
    select(doc, 10, 10, 30, 30);
    const before = maskSnapshot(doc);
    doc.clearSelection();
    expect(hasSelection(doc.mask)).toBe(false);
    doc.undo();
    expect(maskSnapshot(doc)).toBe(before);
    expect(hasSelection(doc.mask)).toBe(true);
  });

  it('R12 fill is one undoable step', () => {
    const doc = EditDocument.create(createRaster(W, H, 0xffffffff));
    select(doc, 10, 10, 30, 30);
    const before = snapshot(doc);
    doc.fill(RED);
    expect(snapshot(doc)).not.toBe(before);
    doc.undo();
    expect(snapshot(doc)).toBe(before);
  });

  it('R14 when the memory budget is passed the oldest steps are dropped and the document says so', () => {
    const doc = EditDocument.create(createRaster(W, H), { budgetBytes: 40_000 });
    for (let k = 0; k < 30; k += 1) paint(doc, seg(5, 5 + k * 4, 190, 5 + k * 4), 12);
    expect(doc.droppedOlder).toBe(true);
    let undone = 0;
    while (doc.undo() !== null) undone += 1;
    expect(undone).toBeGreaterThan(0);
    expect(undone).toBeLessThan(30);
  });

  it('R14 undone steps count toward the memory budget and are freed when dropped', () => {
    const doc = EditDocument.create(createRaster(W, H), { budgetBytes: 1_000_000 });
    paint(doc, seg(5, 5, 190, 140), 20);
    const withDone = doc.historyBytes;
    doc.undo();
    expect(doc.historyBytes).toBe(withDone);
    paint(doc, seg(5, 140, 190, 5), 3); // drops the undone step
    expect(doc.historyBytes).toBeLessThan(withDone + 1);
  });
});

describe('EditDocument.pixelChanged (reference-editor R15)', () => {
  it('R15 a new document has no pixel change', () => {
    expect(EditDocument.create(createRaster(W, H)).pixelChanged).toBe(false);
  });

  it('R15 selection-only steps are not a pixel change', () => {
    const doc = EditDocument.create(createRaster(W, H));
    select(doc, 10, 10, 20, 20);
    const journal = doc.beginJournal();
    selectStroke(doc.mask, seg(50, 50, 80, 80), 6, journal);
    doc.push({ kind: 'tiles', journal, changesPixels: false });
    doc.invert();
    doc.clearSelection();
    expect(doc.pixelChanged).toBe(false);
  });

  it('R15 a paint is a pixel change; undoing it makes the document unchanged again', () => {
    const doc = EditDocument.create(createRaster(W, H));
    paint(doc, seg(10, 10, 60, 60));
    expect(doc.pixelChanged).toBe(true);
    doc.undo();
    expect(doc.pixelChanged).toBe(false);
    doc.redo();
    expect(doc.pixelChanged).toBe(true);
  });

  it('R15 a crop and a fill are pixel changes', () => {
    const doc = EditDocument.create(createRaster(W, H));
    select(doc, 10, 10, 20, 20);
    doc.fill(RED);
    expect(doc.pixelChanged).toBe(true);
  });

  it('R15 a pixel step dropped by the memory limit still counts as a change', () => {
    const doc = EditDocument.create(createRaster(W, H), { budgetBytes: 20_000 });
    paint(doc, seg(5, 5, 190, 140), 14);
    for (let k = 0; k < 20; k += 1) select(doc, 0, k * 5, 190, 4);
    expect(doc.droppedOlder).toBe(true);
    expect(doc.pixelChanged).toBe(true);
  });
});
