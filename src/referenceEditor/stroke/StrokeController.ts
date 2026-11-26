import type { EditDocument } from '../document/EditDocument';
import { INITIAL_INTERACTION, stepInteraction, type InteractionEvent, type InteractionState, type ToolId } from '../machine/interaction';
import type { Point, Rect } from '../model/geometry';
import type { EditorSettings } from './settings';
import { createPaintTool, createSelectBrushTool } from './tools/brushTools';
import { createSelectRectTool } from './tools/selectRectTool';
import type { Overlay, Tool } from './tools/tool';

/** What the view must do after one event. */
export interface StrokeEffects {
  /** Regions to repaint (picture and overlay). */
  dirty: Rect[];
  dirtyAll: boolean;
  /** Screen-pixel pan delta while a pan drag is in progress. */
  pan: Point | null;
  /** Horizontal screen-pixel delta of a Shift-move brush resize (R6); null otherwise. */
  resize: number | null;
  /** The event is a document or settings event, accepted now: the view runs it. False while dragging or panning. */
  passThrough: boolean;
  overlay: Overlay | null;
}

const NOTHING = (overlay: Overlay | null): StrokeEffects => ({ dirty: [], dirtyAll: false, pan: null, resize: null, passThrough: false, overlay });

/**
 * Runs the pointer interaction machine and the active tool. Events carry stage (screen) coordinates; `toImage` maps them to
 * image pixels. Owns no document state: every write goes through the tool and the EditDocument.
 */
export class StrokeController {
  private state: InteractionState = INITIAL_INTERACTION;
  private readonly tools: Record<ToolId, Tool> = { paint: createPaintTool(), selectBrush: createSelectBrushTool(), selectRect: createSelectRectTool() };

  constructor(private readonly doc: EditDocument, private readonly toImage: (stage: Point) => Point) {}

  get interaction(): InteractionState { return this.state; }
  get isIdle(): boolean { return this.state.s === 'idle'; }

  handle(event: InteractionEvent, settings: EditorSettings): StrokeEffects {
    const before = this.state;
    const step = stepInteraction(before, event, { tool: settings.tool, hasSelection: this.doc.hasSelection });
    this.state = step.state;
    const ctx = { doc: this.doc, settings };
    const tool = before.s === 'dragging' ? this.tools[before.tool] : this.tools[settings.tool];
    const image = (p: Point): Point => { const q = this.toImage(p); return { x: Math.floor(q.x), y: Math.floor(q.y) }; };
    switch (step.effect) {
      case 'beginTool': return this.painted(tool, tool.begin(ctx, image((event as { p: Point }).p)));
      case 'moveTool': return this.painted(tool, tool.move(ctx, image((event as { p: Point }).p)));
      case 'endTool': {
        const { command, dirty } = tool.end(ctx);
        if (command !== null) this.doc.push(command);
        return { ...NOTHING(null), dirty };
      }
      case 'cancelTool': return { ...NOTHING(null), dirty: tool.cancel(ctx) };
      case 'clearSelection': return { ...NOTHING(null), dirtyAll: this.doc.clearSelection() !== null };
      case 'pan': {
        const now = (event as { p: Point }).p;
        const last = before.s === 'panning' ? before.last : now;
        return { ...NOTHING(null), pan: { x: now.x - last.x, y: now.y - last.y } };
      }
      case 'resizeBrush': return { ...NOTHING(null), resize: (event as { p: Point }).p.x - (before.s === 'idle' && before.hover !== undefined ? before.hover.x : (event as { p: Point }).p.x) };
      case 'passThrough': return { ...NOTHING(null), passThrough: true };
      case 'none': return NOTHING(null);
    }
  }

  private painted(tool: Tool, rect: Rect | null): StrokeEffects {
    return { ...NOTHING(tool.preview()), dirty: rect === null ? [] : [rect] };
  }
}
