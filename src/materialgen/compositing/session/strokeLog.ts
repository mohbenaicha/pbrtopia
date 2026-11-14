import type { PaintSettings } from '../gpu/createStampPainter';
import type { BrushParams } from '../plan/brushParams';
import type { Point, ShapeSlot } from '../plan/planStamps';

/** The maps Done may write (R22); roughness and metal share the packed texture but are two stored maps. */
export type PaintedMap = 'albedo' | 'rough' | 'metal' | 'height' | 'normal';
const ORDER: readonly PaintedMap[] = ['albedo', 'rough', 'metal', 'height', 'normal'];

/** What a stroke needs to be replayed (R71): the seed, the brush and shapes it was drawn with, the settings, and then its path. */
export interface StrokeHeader {
  id: number;
  seed: number;
  params: BrushParams;
  shapes: readonly ShapeSlot[];
  settings: PaintSettings;
}

export interface LoggedStroke extends StrokeHeader { path: Point[] }

/**
 * Compositing R22, R71: the strokes of the session. Kept apart from the GPU journal so the maps Done writes do not depend on what the journal still holds:
 * a stroke dropped for budget, or too large to undo, still counts as applied; one undone away does not.
 */
export interface StrokeLog {
  begin(header: StrokeHeader): void;
  extend(point: Point): void;
  /** `undoable` is false for a stroke too large for the journal (R21). */
  end(undoable: boolean): void;
  undo(): LoggedStroke | null;
  redo(): LoggedStroke | null;
  /** The journal evicted its oldest entry. */
  forgetOldestUndo(): void;
  /** The journal could not keep a stroke and dropped every older entry too. */
  dropUndoHistory(): void;
  lastApplied(): LoggedStroke | null;
  undoDepth(): number;
  redoDepth(): number;
  appliedMaps(): PaintedMap[];
}

const mapsOf = (stroke: LoggedStroke): PaintedMap[] => [
  'albedo', 'rough', 'metal',
  ...(stroke.settings.height === null ? [] : ['height' as const]),
  ...(stroke.settings.edgeBurn === null ? [] : ['normal' as const]),
];

export function createStrokeLog(): StrokeLog {
  let open: LoggedStroke | null = null;
  let undoStack: LoggedStroke[] = [];
  let redoStack: LoggedStroke[] = [];
  let fixed: LoggedStroke[] = []; // applied, but no longer undoable
  return {
    begin: (header) => { open = { ...header, path: [] }; redoStack = []; },
    extend: (point) => { open?.path.push(point); },
    end: (undoable) => {
      if (open === null) return;
      (undoable ? undoStack : fixed).push(open);
      open = null;
    },
    undo: () => {
      const stroke = undoStack.pop();
      if (stroke === undefined) return null;
      redoStack.push(stroke);
      return stroke;
    },
    redo: () => {
      const stroke = redoStack.pop();
      if (stroke === undefined) return null;
      undoStack.push(stroke);
      return stroke;
    },
    forgetOldestUndo: () => { const oldest = undoStack.shift(); if (oldest !== undefined) fixed.push(oldest); },
    dropUndoHistory: () => { fixed = [...fixed, ...undoStack]; undoStack = []; },
    lastApplied: () => undoStack[undoStack.length - 1] ?? fixed[fixed.length - 1] ?? null,
    undoDepth: () => undoStack.length,
    redoDepth: () => redoStack.length,
    appliedMaps: () => {
      const present = new Set<PaintedMap>();
      for (const stroke of [...fixed, ...undoStack]) for (const map of mapsOf(stroke)) present.add(map);
      return ORDER.filter((map) => present.has(map));
    },
  };
}
