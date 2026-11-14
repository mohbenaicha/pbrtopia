import type { WebGLRenderer, Texture } from 'three';
import { createStampPainter, type PainterMaps, type StampPainter } from '../gpu/createStampPainter';
import { createTileJournal, type TileJournal, type TileJournalOptions } from '../gpu/createTileJournal';
import type { PaintMaterial } from '../gpu/paintMaterial';
import type { AtlasGrid } from '../gpu/stampGeometry';
import { DEFAULT_BRUSH, clampBrush, type BrushParams } from '../plan/brushParams';
import { peekNextStamp, planSegment, startStroke, type PeekedStamp, type PlanContext, type PlanState, type Point, type ShapeSlot, type Stamp } from '../plan/planStamps';
import { paintSettingsOf } from './paintSettings';
import { createStampQueue, type StampQueue } from './stampQueue';
import { createStrokeLog, type PaintedMap, type StrokeHeader, type StrokeLog } from './strokeLog';

/** Compositing A4.3: stamp-pixels per frame (about 16 megapixel-maps); tunable. */
export const FRAME_BUDGET_PIXELS = 8_000_000;

export interface PaintSessionOptions {
  side: number;
  atlas: { data: Uint8Array<ArrayBuffer>; width: number; height: number };
  grid: AtlasGrid;
  maps: PainterMaps;
  normalDirection: 'opengl' | 'directx';
  material: PaintMaterial;
  shapes?: readonly ShapeSlot[];
  journal?: TileJournalOptions;
  frameBudgetPixels?: number;
  strokeCapPixels?: number;
  /** Seeds of strokes; defaults to `Math.random`. Tests pass a counter. */
  random?: () => number;
}

/** What Done reads back, in the painter's byte layout (picture order); a map nobody painted is left out (R22). */
export interface PaintedBytes {
  albedo?: Uint8Array;
  /** Packed R = AO, G = roughness, B = metal; present when roughness or metal was painted. */
  orm?: Uint8Array;
  height?: Uint8Array;
  normal?: Uint8Array;
  applied: PaintedMap[];
}

export interface PaintSession {
  readonly side: number;
  setBrush(params: BrushParams): void;
  brush(): BrushParams;
  setShapes(shapes: readonly ShapeSlot[]): void;
  setMaterial(material: PaintMaterial): void;
  // strokes (R10)
  pointerDown(point: Point): void;
  pointerMove(point: Point): void;
  pointerUp(): void;
  // straight lines (R13)
  setLineMarker(point: Point): void;
  hasLineMarker(): boolean;
  clearLineMarker(): void;
  ghostLine(to: Point): Stamp[];
  commitLine(to: Point): void;
  /** The shape and angle the next stamp would have, for the ghost (R14). */
  peekNext(): PeekedStamp | null;
  /** Draw queued stamps within the frame budget; `more` while stamps wait. */
  step(): { painted: boolean; more: boolean };
  undo(): boolean;
  redo(): boolean;
  canUndo(): boolean;
  canRedo(): boolean;
  hasStrokes(): boolean;
  /** True once a stroke passed its stamp cap (R37) or was too large to undo (R21). */
  notice(): 'too-many-stamps' | 'too-large-to-undo' | null;
  textures(): { albedo: Texture; orm: Texture; height: Texture | null; normal: Texture | null };
  /** The shape atlas texture, for the ghost. */
  atlasTexture(): Texture;
  /** The height reduced to a small picture for the surface pick (R26), or null while the session has no height map. */
  readHeightProxy(side: number): Uint8Array | null;
  /** Draws everything still queued, then reads the painted maps (Done). */
  readPainted(): PaintedBytes;
  dispose(): void;
}

interface OpenInput { id: number; header: StrokeHeader; state: PlanState; last: Point; path: Point[] }
interface QueuedMeta { header: StrokeHeader; path: Point[] }

export function createPaintSession(renderer: WebGLRenderer, options: PaintSessionOptions): PaintSession {
  const painter: StampPainter = createStampPainter(renderer, { side: options.side, atlas: options.atlas, grid: options.grid, maps: options.maps, normalDirection: options.normalDirection });
  const journal: TileJournal = createTileJournal(renderer, painter, options.journal ?? {});
  const queue: StampQueue = createStampQueue({ side: options.side, ...(options.strokeCapPixels === undefined ? {} : { strokeCapPixels: options.strokeCapPixels }) });
  const log: StrokeLog = createStrokeLog();
  const random = options.random ?? Math.random;
  const budget = options.frameBudgetPixels ?? FRAME_BUDGET_PIXELS;
  let brush: BrushParams = DEFAULT_BRUSH;
  let shapes: readonly ShapeSlot[] = options.shapes ?? [];
  let material = options.material;
  let nextId = 1;
  let input: OpenInput | null = null;
  let marker: { point: Point; seed: number; state: PlanState } | null = null;
  const metas = new Map<number, QueuedMeta>();
  let drawing: number | null = null; // the stroke whose journal entry is open
  let notice: ReturnType<PaintSession['notice']> = null;

  const contextOf = (params: BrushParams): PlanContext => ({ params, shapes, texel: 1 / options.side });
  const newSeed = (): number => Math.floor(random() * 0xffffffff);
  const headerOf = (id: number, seed: number): StrokeHeader => ({ id, seed, params: brush, shapes, settings: paintSettingsOf(brush, material) });
  const enqueue = (id: number, stamps: Stamp[]): void => { if (queue.push(id, stamps).tooMany) notice = 'too-many-stamps'; };

  const finishDrawing = (id: number): void => {
    const meta = metas.get(id)!;
    const { kept } = journal.endStroke();
    log.begin(meta.header);
    meta.path.forEach((point) => log.extend(point));
    log.end(kept);
    if (!kept) { log.dropUndoHistory(); notice = 'too-large-to-undo'; }
    while (log.undoDepth() > journal.stats().undoEntries) log.forgetOldestUndo();
    metas.delete(id);
    drawing = null;
  };

  const step = (): { painted: boolean; more: boolean } => {
    const batch = queue.take(budget);
    if (batch === null) return { painted: false, more: false };
    const meta = metas.get(batch.stroke)!;
    if (drawing === null) { journal.beginStroke(); drawing = batch.stroke; }
    if (batch.stamps.length > 0) painter.paint(batch.stamps, meta.header.settings);
    if (batch.finished) finishDrawing(batch.stroke);
    if (batch.stamps.length > 0) painter.rebuildMipmaps();
    return { painted: batch.stamps.length > 0, more: queue.pending() > 0 || metas.size > 0 };
  };
  // Draw everything queued (Done, and Undo when strokes still wait): one batch per stroke, so the journal still sees each stroke whole.
  const drain = (): void => {
    for (let batch = queue.take(Number.POSITIVE_INFINITY); batch !== null; batch = queue.take(Number.POSITIVE_INFINITY)) {
      const meta = metas.get(batch.stroke)!;
      if (drawing === null) { journal.beginStroke(); drawing = batch.stroke; }
      if (batch.stamps.length > 0) painter.paint(batch.stamps, meta.header.settings);
      if (batch.finished) finishDrawing(batch.stroke);
    }
  };

  const startInput = (point: Point, seed: number, state: PlanState): OpenInput => {
    const id = nextId;
    nextId += 1;
    const header = headerOf(id, seed);
    metas.set(id, { header, path: [] });
    return { id, header, state, last: point, path: metas.get(id)!.path };
  };

  const stampsInto = (open: OpenInput, from: Point, to: Point): void => {
    const planned = planSegment(contextOf(open.header.params), open.state, from, to);
    open.state = planned.state;
    enqueue(open.id, planned.stamps);
  };

  return {
    side: options.side,
    setBrush: (params) => { brush = clampBrush(params); },
    brush: () => brush,
    setShapes: (next) => { shapes = next; },
    setMaterial: (next) => { material = next; },
    pointerDown: (point) => {
      if (shapes.length === 0 || input !== null) return;
      const seed = newSeed();
      input = startInput(point, seed, startStroke(seed));
      input.path.push(point);
      stampsInto(input, point, point);
    },
    pointerMove: (point) => {
      if (input === null) return;
      stampsInto(input, input.last, point);
      input.path.push(point);
      input.last = point;
    },
    pointerUp: () => {
      if (input === null) return;
      queue.closeStroke(input.id);
      input = null;
    },
    setLineMarker: (point) => { const seed = newSeed(); marker = { point, seed, state: startStroke(seed) }; },
    hasLineMarker: () => marker !== null,
    clearLineMarker: () => { marker = null; },
    ghostLine: (to) => (marker === null || shapes.length === 0 ? [] : planSegment(contextOf(brush), marker.state, marker.point, to).stamps),
    commitLine: (to) => {
      if (marker === null || shapes.length === 0) return;
      const open = startInput(marker.point, marker.seed, marker.state);
      open.path.push(marker.point, to);
      stampsInto(open, marker.point, to);
      queue.closeStroke(open.id);
      marker = { point: to, seed: marker.seed, state: open.state }; // the next line continues the spacing from here (R13)
    },
    peekNext: () => {
      const state = input?.state ?? marker?.state ?? startStroke(0);
      return peekNextStamp(contextOf(brush), state);
    },
    step,
    undo: () => {
      if (input !== null) return false;
      if (drawing !== null) { queue.dropStroke(drawing); finishDrawing(drawing); } // the part already drawn is the stroke to undo (R37)
      drain();
      if (!journal.canUndo()) return false;
      journal.undo();
      log.undo();
      painter.rebuildMipmaps();
      return true;
    },
    redo: () => {
      if (input !== null || queue.pending() > 0) return false;
      if (!journal.redo()) return false;
      log.redo();
      painter.rebuildMipmaps();
      return true;
    },
    canUndo: () => input === null && (journal.canUndo() || drawing !== null || queue.pending() > 0),
    canRedo: () => input === null && queue.pending() === 0 && journal.canRedo(),
    hasStrokes: () => log.appliedMaps().length > 0 || queue.pending() > 0 || drawing !== null,
    notice: () => notice,
    textures: () => ({ albedo: painter.texture('albedo'), orm: painter.texture('orm'), height: painter.journalTarget('height') === null ? null : painter.texture('height'), normal: painter.journalTarget('slope') === null ? null : painter.texture('normal') }),
    atlasTexture: () => painter.atlas,
    readHeightProxy: (side) => painter.readHeightProxy(side),
    readPainted: () => {
      drain();
      const applied = log.appliedMaps();
      const out: PaintedBytes = { applied };
      if (applied.includes('albedo')) out.albedo = painter.readBytes('albedo');
      if (applied.includes('rough') || applied.includes('metal')) out.orm = painter.readBytes('orm');
      if (applied.includes('height')) out.height = painter.readBytes('height');
      if (applied.includes('normal')) out.normal = painter.readBytes('normal');
      return out;
    },
    dispose: () => { queue.clear(); journal.dispose(); painter.dispose(); },
  };
}
