import type { Command } from '../../history/HistoryStack';
import { isJournalEmpty, swapJournal, type TileJournal } from '../../history/TileJournal';
import type { ToolId } from '../../machine/interaction';
import type { Point, Rect } from '../../model/geometry';
import type { Segment } from '../../ops/capsuleSpans';
import { paintStroke } from '../../ops/paintStroke';
import { selectStroke } from '../../ops/selectStroke';
import type { Tool, ToolContext } from './tool';

type ApplySegment = (ctx: ToolContext, seg: Segment, journal: TileJournal) => Rect | null;

/** A drag that sweeps the round brush along the pointer path: the same lifecycle for painting and for selecting, only the written layer differs. */
function createBrushTool(id: ToolId, changesPixels: boolean, applySegment: ApplySegment): Tool {
  let journal: TileJournal | null = null;
  let last: Point = { x: 0, y: 0 };
  const reset = (): void => { journal = null; };
  return {
    id,
    begin(ctx, p) {
      journal = ctx.doc.beginJournal();
      last = p;
      return applySegment(ctx, { from: p, to: p, first: true }, journal);
    },
    move(ctx, p) {
      if (journal === null || (p.x === last.x && p.y === last.y)) return null;
      const rect = applySegment(ctx, { from: last, to: p, first: false }, journal);
      last = p;
      return rect;
    },
    end() {
      const done = journal;
      reset();
      if (done === null || isJournalEmpty(done)) return { command: null, dirty: [] };
      const command: Command = { kind: 'tiles', journal: done, changesPixels };
      return { command, dirty: [] }; // the pixels were repainted while dragging
    },
    cancel(ctx) {
      const open = journal;
      reset();
      return open === null ? [] : swapJournal(open, ctx.doc.raster, ctx.doc.mask);
    },
    preview: () => null,
  };
}

export const createPaintTool = (): Tool => createBrushTool('paint', true, (ctx, seg, journal) => paintStroke(ctx.doc.raster, ctx.doc.hasSelection ? ctx.doc.mask : null, seg, ctx.settings.brushSize, ctx.settings.colour, journal));
export const createSelectBrushTool = (): Tool => createBrushTool('selectBrush', false, (ctx, seg, journal) => selectStroke(ctx.doc.mask, seg, ctx.settings.brushSize, journal));
