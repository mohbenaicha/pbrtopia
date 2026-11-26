import type { EditDocument } from '../../document/EditDocument';
import type { Command } from '../../history/HistoryStack';
import type { ToolId } from '../../machine/interaction';
import type { Point, Rect } from '../../model/geometry';
import type { EditorSettings } from '../settings';

export interface ToolContext { doc: EditDocument; settings: EditorSettings }
/** Drawn on the overlay while a drag is in progress (outline only). */
export type Overlay = { kind: 'rect'; rect: Rect };

/** One pointer tool (Strategy). Points are integer image pixels. Each method returns the region to repaint (null = nothing). */
export interface Tool {
  readonly id: ToolId;
  begin(ctx: ToolContext, p: Point): Rect | null;
  move(ctx: ToolContext, p: Point): Rect | null;
  /** The command to push (null when the drag changed nothing) and the regions still to repaint (e.g. where a rubber band was). */
  end(ctx: ToolContext): { command: Command | null; dirty: Rect[] };
  /** Esc / blur / pointercancel: undoes what the drag wrote; returns the regions to repaint. */
  cancel(ctx: ToolContext): Rect[];
  preview(): Overlay | null;
}
