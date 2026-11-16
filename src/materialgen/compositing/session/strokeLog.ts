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

export interface LoggedStroke extends StrokeHeader { kind: 'stroke'; path: Point[] }

/** Clone R16, R17: a confirmed copy is not replayable from a path; it lists the maps it changed. */
export interface LoggedPlacement { kind: 'placement'; id: number; maps: readonly PaintedMap[] }

export type LoggedEdit = LoggedStroke | LoggedPlacement;

/**
 * Compositing R22, R71 and clone R16: the strokes and placements of the session, one timeline. Kept apart from the GPU journal so the maps Done writes do not
 * depend on what the journal still holds: an edit dropped for budget, or too large to undo, still counts as applied; one undone away does not.
 */
export interface StrokeLog {
  begin(header: StrokeHeader): void;
  extend(point: Point): void;
  /** `undoable` is false for a stroke too large for the journal (R21). */
  end(undoable: boolean): void;
  /** Logs a confirmed placement in one step (clone R12); `undoable` as for `end`. */
  placement(maps: readonly PaintedMap[], undoable: boolean): void;
  undo(): LoggedEdit | null;
  redo(): LoggedEdit | null;
  /** The journal evicted its oldest entry. */
  forgetOldestUndo(): void;
  /** The journal could not keep an edit and dropped every older entry too. */
  dropUndoHistory(): void;
  lastApplied(): LoggedEdit | null;
  undoDepth(): number;
  redoDepth(): number;
  appliedMaps(): PaintedMap[];
}

const mapsOf = (edit: LoggedEdit): readonly PaintedMap[] => edit.kind === 'placement' ? edit.maps : [
  'albedo', 'rough', 'metal',
  ...(edit.settings.height === null ? [] : ['height' as const]),
  ...(edit.settings.edgeBurn === null ? [] : ['normal' as const]),
];

export function createStrokeLog(): StrokeLog {
  let open: LoggedStroke | null = null;
  let undoStack: LoggedEdit[] = [];
  let redoStack: LoggedEdit[] = [];
  let fixed: LoggedEdit[] = []; // applied, but no longer undoable
  let placements = 0;
  return {
    begin: (header) => { open = { ...header, kind: 'stroke', path: [] }; redoStack = []; },
    extend: (point) => { open?.path.push(point); },
    end: (undoable) => {
      if (open === null) return;
      (undoable ? undoStack : fixed).push(open);
      open = null;
    },
    placement: (maps, undoable) => {
      placements += 1;
      redoStack = [];
      (undoable ? undoStack : fixed).push({ kind: 'placement', id: placements, maps });
    },
    undo: () => {
      const edit = undoStack.pop();
      if (edit === undefined) return null;
      redoStack.push(edit);
      return edit;
    },
    redo: () => {
      const edit = redoStack.pop();
      if (edit === undefined) return null;
      undoStack.push(edit);
      return edit;
    },
    forgetOldestUndo: () => { const oldest = undoStack.shift(); if (oldest !== undefined) fixed.push(oldest); },
    dropUndoHistory: () => { fixed = [...fixed, ...undoStack]; undoStack = []; },
    lastApplied: () => undoStack[undoStack.length - 1] ?? fixed[fixed.length - 1] ?? null,
    undoDepth: () => undoStack.length,
    redoDepth: () => redoStack.length,
    appliedMaps: () => {
      const present = new Set<PaintedMap>();
      for (const edit of [...fixed, ...undoStack]) for (const map of mapsOf(edit)) present.add(map);
      return ORDER.filter((map) => present.has(map));
    },
  };
}
