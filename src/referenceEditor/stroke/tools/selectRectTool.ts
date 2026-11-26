import { isJournalEmpty } from '../../history/TileJournal';
import { unionRect, type Point, type Rect } from '../../model/geometry';
import { selectRect } from '../../ops/selectRect';
import type { Overlay, Tool, ToolContext } from './tool';

const clampTo = (ctx: ToolContext, p: Point): Point => ({ x: Math.min(ctx.doc.mask.width - 1, Math.max(0, p.x)), y: Math.min(ctx.doc.mask.height - 1, Math.max(0, p.y)) });
const between = (a: Point, b: Point): Rect => ({ x: Math.min(a.x, b.x), y: Math.min(a.y, b.y), w: Math.abs(a.x - b.x) + 1, h: Math.abs(a.y - b.y) + 1 });

const padded = (rect: Rect | null): Rect | null => (rect === null ? null : { x: rect.x - 2, y: rect.y - 2, w: rect.w + 4, h: rect.h + 4 }); // room for the outline's stroke

/** Rubber band: only an outline is drawn while dragging; the mask is written once, on release (architecture D5). */
export function createSelectRectTool(): Tool {
  let start: Point | null = null;
  let current: Point = { x: 0, y: 0 };
  const band = (): Rect | null => (start === null ? null : between(start, current));
  return {
    id: 'selectRect',
    begin(ctx, p) {
      start = clampTo(ctx, p);
      current = start;
      return padded(band());
    },
    move(ctx, p) {
      if (start === null) return null;
      const before = band();
      current = clampTo(ctx, p);
      return padded(unionRect(before, band()));
    },
    end(ctx) {
      const rect = band();
      start = null;
      if (rect === null) return { command: null, dirty: [] };
      const journal = ctx.doc.beginJournal();
      selectRect(ctx.doc.mask, rect, journal);
      const dirty = [padded(rect)!]; // the new selection is tinted and the outline is wiped
      return isJournalEmpty(journal) ? { command: null, dirty } : { command: { kind: 'tiles', journal, changesPixels: false }, dirty };
    },
    cancel() {
      const rect = padded(band());
      start = null;
      return rect === null ? [] : [rect];
    },
    preview(): Overlay | null {
      const rect = band();
      return rect === null ? null : { kind: 'rect', rect };
    },
  };
}
