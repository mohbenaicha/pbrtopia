import { describe, expect, it } from 'vitest';
import { EditDocument } from '../../../src/referenceEditor/document/EditDocument';
import { createRaster } from '../../../src/referenceEditor/model/raster';
import { packColour } from '../../../src/referenceEditor/model/packColour';
import { clampBrushSize, resizeBrushBy, stepBrushSize, type EditorSettings } from '../../../src/referenceEditor/stroke/settings';
import { StrokeController } from '../../../src/referenceEditor/stroke/StrokeController';

const W = 120;
const H = 90;
const WHITE = 0xffffffff;
const settings = (over: Partial<EditorSettings> = {}): EditorSettings => ({ tool: 'paint', colour: packColour('#ff0000'), brushSize: 9, ...over });
const setup = () => {
  const doc = EditDocument.create(createRaster(W, H));
  return { doc, ctl: new StrokeController(doc, (p) => p) };
};
const down = (x: number, y: number, pointerId = 1, button = 0) => ({ t: 'down' as const, button, pointerId, p: { x, y } });
const move = (x: number, y: number, pointerId = 1) => ({ t: 'move' as const, pointerId, p: { x, y } });
const up = (pointerId = 1) => ({ t: 'up' as const, pointerId });
const paintedCount = (doc: EditDocument) => doc.raster.words.reduce((count, word) => count + (word === WHITE ? 0 : 1), 0);

describe('StrokeController (reference-editor R7-R10)', () => {
  it('R7 one drag is one history step: undo takes the whole stroke back', () => {
    const { doc, ctl } = setup();
    ctl.handle(down(10, 10), settings());
    ctl.handle(move(40, 30), settings());
    ctl.handle(move(80, 60), settings());
    ctl.handle(up(), settings());
    expect(paintedCount(doc)).toBeGreaterThan(0);
    doc.undo();
    expect(paintedCount(doc)).toBe(0);
    expect(doc.undo()).toBeNull();
  });

  it('R6 Shift + moving (no button) resizes the brush: reports the horizontal deltas, writes no pixel, no selection, no history', () => {
    const { doc, ctl } = setup();
    const shifted = (x: number, y: number) => ({ ...move(x, y), shift: true });
    expect(ctl.handle(move(10, 10), settings()).resize).toBeNull();
    expect(ctl.handle(shifted(30, 12), settings()).resize).toBe(20);
    expect(ctl.handle(shifted(25, 40), settings()).resize).toBe(-5);
    expect(ctl.handle(move(60, 40), settings()).resize).toBeNull();
    expect(ctl.handle(shifted(70, 40), settings({ tool: 'selectRect' })).resize).toBeNull();
    expect(paintedCount(doc)).toBe(0);
    expect(doc.hasSelection).toBe(false);
    expect(doc.canUndo).toBe(false);
    expect(ctl.isIdle).toBe(true);
  });

  it('R7 a drag reports the regions to repaint', () => {
    const { ctl } = setup();
    const first = ctl.handle(down(10, 10), settings());
    const next = ctl.handle(move(40, 30), settings());
    expect(first.dirty.length).toBe(1);
    expect(next.dirty.length).toBe(1);
  });

  it('R10 Esc during a drag rolls the stroke back and pushes nothing', () => {
    const { doc, ctl } = setup();
    ctl.handle(down(10, 10), settings());
    ctl.handle(move(60, 40), settings());
    expect(paintedCount(doc)).toBeGreaterThan(0);
    const out = ctl.handle({ t: 'escape' }, settings());
    expect(paintedCount(doc)).toBe(0);
    expect(out.dirty.length).toBeGreaterThan(0);
    expect(doc.canUndo).toBe(false);
    expect(ctl.isIdle).toBe(true);
  });

  it('R8 brush select adds to the selection over several drags, one step each', () => {
    const { doc, ctl } = setup();
    const s = settings({ tool: 'selectBrush' });
    ctl.handle(down(10, 10), s); ctl.handle(move(30, 10), s); ctl.handle(up(), s);
    const first = doc.mask.cells.reduce((n, c) => n + c, 0);
    ctl.handle(down(10, 60), s); ctl.handle(move(30, 60), s); ctl.handle(up(), s);
    expect(doc.mask.cells.reduce((n, c) => n + c, 0)).toBeGreaterThan(first);
    doc.undo();
    expect(doc.mask.cells.reduce((n, c) => n + c, 0)).toBe(first);
    expect(paintedCount(doc)).toBe(0);
  });

  it('R7 with a selection, painting changes only selected pixels', () => {
    const { doc, ctl } = setup();
    const rect = settings({ tool: 'selectRect' });
    ctl.handle(down(20, 20), rect); ctl.handle(move(60, 50), rect); ctl.handle(up(), rect);
    ctl.handle(down(0, 35), settings()); ctl.handle(move(119, 35), settings()); ctl.handle(up(), settings());
    for (let index = 0; index < W * H; index += 1) if (doc.raster.words[index] !== WHITE) expect(doc.mask.cells[index]).toBe(1);
    expect(paintedCount(doc)).toBeGreaterThan(0);
  });

  it('R9 the rectangle is selected on release only; while dragging an outline is previewed and the mask is untouched', () => {
    const { doc, ctl } = setup();
    const s = settings({ tool: 'selectRect' });
    ctl.handle(down(10, 10), s);
    const dragging = ctl.handle(move(50, 40), s);
    expect(doc.hasSelection).toBe(false);
    expect(dragging.overlay).toEqual({ kind: 'rect', rect: { x: 10, y: 10, w: 41, h: 31 } });
    ctl.handle(up(), s);
    expect(doc.mask.bounds).toEqual({ minX: 10, minY: 10, maxX: 50, maxY: 40 });
  });

  it('R9 a drag that starts outside the picture is clamped to its edge and reversed corners are normalised', () => {
    const { doc, ctl } = setup();
    const s = settings({ tool: 'selectRect' });
    ctl.handle(down(-30, -30), s); ctl.handle(move(5, 5), s); ctl.handle(up(), s);
    expect(doc.mask.bounds).toEqual({ minX: 0, minY: 0, maxX: 5, maxY: 5 });
    ctl.handle(down(100, 80), s); ctl.handle(move(90, 70), s); ctl.handle(up(), s);
    expect(doc.mask.bounds.maxX).toBe(100);
  });

  it('R10 Esc with a select tool and a selection clears it in one step; with the paint tool it does nothing', () => {
    const { doc, ctl } = setup();
    const s = settings({ tool: 'selectRect' });
    ctl.handle(down(10, 10), s); ctl.handle(move(50, 40), s); ctl.handle(up(), s);
    expect(ctl.handle({ t: 'escape' }, settings()).dirtyAll).toBe(false);
    expect(doc.hasSelection).toBe(true);
    expect(ctl.handle({ t: 'escape' }, s).dirtyAll).toBe(true);
    expect(doc.hasSelection).toBe(false);
    doc.undo();
    expect(doc.hasSelection).toBe(true);
  });

  it('R10 while dragging, document events are not passed through; while idle they are', () => {
    const { ctl } = setup();
    expect(ctl.handle({ t: 'undo' }, settings()).passThrough).toBe(true);
    ctl.handle(down(5, 5), settings());
    expect(ctl.handle({ t: 'undo' }, settings()).passThrough).toBe(false);
    ctl.handle(up(), settings());
  });

  it('R5 a pan drag reports screen deltas and never touches the picture', () => {
    const { doc, ctl } = setup();
    ctl.handle(down(10, 10, 1, 1), settings());
    const out = ctl.handle(move(25, 4), settings());
    expect(out.pan).toEqual({ x: 15, y: -6 });
    expect(paintedCount(doc)).toBe(0);
  });

  it('R7 another pointer during a drag is ignored', () => {
    const { doc, ctl } = setup();
    ctl.handle(down(10, 10, 1), settings());
    ctl.handle(down(80, 80, 2), settings());
    ctl.handle(move(90, 85, 2), settings());
    ctl.handle(up(1), settings());
    expect(doc.raster.words[85 * W + 90]).toBe(WHITE);
  });

  it('R6 brush size stays in 1..256 and the bracket keys change it by 10 % (at least 1)', () => {
    expect(clampBrushSize(0)).toBe(1);
    expect(clampBrushSize(999)).toBe(256);
    expect(resizeBrushBy(24, 60)).toBeCloseTo(49.5, 5); // R6: 600 px sweeps the whole 1..256 range, evenly
    expect(resizeBrushBy(100, -60)).toBeCloseTo(74.5, 5);
    expect(resizeBrushBy(1, 600)).toBe(256);
    expect(resizeBrushBy(256, -600)).toBe(1);
    expect(stepBrushSize(100, 1)).toBe(110);
    expect(stepBrushSize(100, -1)).toBe(90);
    expect(stepBrushSize(3, 1)).toBe(4);
    expect(stepBrushSize(1, -1)).toBe(1);
    expect(stepBrushSize(256, 1)).toBe(256);
  });
});
