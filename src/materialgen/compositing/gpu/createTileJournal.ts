import type { WebGLRenderer } from 'three';
import type { JournalKind, StampPainter } from './createStampPainter';
import { glFramebufferOf, glTextureOf } from './rawGl';
import { unionRect, type TexelRect } from './stampGeometry';
import { withRendererState } from './withRendererState';

const KINDS: readonly JournalKind[] = ['albedo', 'orm', 'height', 'slope'];
const BYTES_PER_PIXEL: Record<JournalKind, number> = { albedo: 4, orm: 4, height: 1, slope: 4 };
const DEFAULT_BUDGET_BYTES = 64 * 1024 * 1024;
const DEFAULT_PAGE_SLOTS = { columns: 32, rows: 16 }; // 512 slots: 8 MB of albedo per page

export interface TileJournalOptions {
  tile?: number; // texels per side (A6: 64)
  pageSlots?: { columns: number; rows: number };
  budgetBytes?: number; // all pages of all maps together (R21: 64 MB)
}

export interface TileJournalStats {
  undoEntries: number;
  redoEntries: number;
  slotsInUse: Record<JournalKind, number>;
  allocatedBytes: number;
}

/**
 * Compositing A6: session undo by tile snapshots. Tiles about to change are copied raw (never through a shader, so sRGB stays byte exact) into snapshot
 * pages before the frame's draws; undo and redo swap live and saved tiles, then recompose the normal. Depth is bytes, not a count (R21).
 */
export interface TileJournal {
  beginStroke(): void;
  /** Installed as the painter's before-draw hook by `createTileJournal`; callable directly in tests. */
  record(rect: TexelRect, kinds: readonly JournalKind[]): void;
  /** `kept` is false only when the stroke was larger than the whole budget: it stays applied but cannot be undone (R21, E6). */
  endStroke(): { kept: boolean };
  undo(): boolean;
  redo(): boolean;
  canUndo(): boolean;
  canRedo(): boolean;
  stats(): TileJournalStats;
  dispose(): void;
}

interface Page { texture: WebGLTexture; framebuffer: WebGLFramebuffer }
interface SavedTile { tile: number; slot: number }
type Entry = Record<JournalKind, SavedTile[]>;
interface OpenStroke { saved: Record<JournalKind, Map<number, number>>; overflow: boolean }

const emptyEntry = (): Entry => ({ albedo: [], orm: [], height: [], slope: [] });
const emptyStroke = (): OpenStroke => ({ saved: { albedo: new Map(), orm: new Map(), height: new Map(), slope: new Map() }, overflow: false });

export function createTileJournal(renderer: WebGLRenderer, painter: StampPainter, options: TileJournalOptions): TileJournal {
  const gl = renderer.getContext() as WebGL2RenderingContext;
  const tile = options.tile ?? 64;
  const pageSlots = options.pageSlots ?? DEFAULT_PAGE_SLOTS;
  const slotsPerPage = pageSlots.columns * pageSlots.rows;
  const budgetBytes = options.budgetBytes ?? DEFAULT_BUDGET_BYTES;
  const tilesAcross = Math.ceil(painter.side / tile);
  const internalFormat: Record<JournalKind, number> = { albedo: gl.SRGB8_ALPHA8, orm: gl.RGBA8, height: gl.R8, slope: gl.RG16F };
  const pageBytes = (kind: JournalKind): number => slotsPerPage * tile * tile * BYTES_PER_PIXEL[kind];

  const pages: Record<JournalKind, Page[]> = { albedo: [], orm: [], height: [], slope: [] };
  const free: Record<JournalKind, number[]> = { albedo: [], orm: [], height: [], slope: [] };
  const scratch: Partial<Record<JournalKind, Page>> = {};
  let allocatedBytes = 0;
  let undoEntries: Entry[] = [];
  let redoEntries: Entry[] = [];
  let open: OpenStroke | null = null;

  const createPage = (kind: JournalKind, width: number, height: number): Page => {
    const texture = gl.createTexture()!;
    gl.bindTexture(gl.TEXTURE_2D, texture);
    gl.texStorage2D(gl.TEXTURE_2D, 1, internalFormat[kind], width, height);
    const framebuffer = gl.createFramebuffer()!;
    gl.bindFramebuffer(gl.READ_FRAMEBUFFER, framebuffer);
    gl.framebufferTexture2D(gl.READ_FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, texture, 0);
    return { texture, framebuffer };
  };

  const freeEntry = (entry: Entry): void => { for (const kind of KINDS) for (const saved of entry[kind]) free[kind].push(saved.slot); };

  const allocateSlot = (kind: JournalKind): number | null => {
    for (;;) {
      const slot = free[kind].pop();
      if (slot !== undefined) return slot;
      if (allocatedBytes + pageBytes(kind) <= budgetBytes) {
        const base = pages[kind].length * slotsPerPage;
        pages[kind].push(createPage(kind, pageSlots.columns * tile, pageSlots.rows * tile));
        allocatedBytes += pageBytes(kind);
        for (let index = slotsPerPage - 1; index >= 0; index -= 1) free[kind].push(base + index);
        continue;
      }
      const oldest = undoEntries.shift();
      if (oldest === undefined) return null;
      freeEntry(oldest); // the oldest strokes drop out silently (R21)
    }
  };

  const tileOrigin = (index: number): { x: number; y: number; width: number; height: number } => {
    const x = (index % tilesAcross) * tile;
    const y = Math.floor(index / tilesAcross) * tile;
    return { x, y, width: Math.min(tile, painter.side - x), height: Math.min(tile, painter.side - y) };
  };
  const slotOrigin = (slot: number): { page: number; x: number; y: number } => {
    const inPage = slot % slotsPerPage;
    return { page: Math.floor(slot / slotsPerPage), x: (inPage % pageSlots.columns) * tile, y: Math.floor(inPage / pageSlots.columns) * tile };
  };
  const copyRegion = (sourceFramebuffer: WebGLFramebuffer, destination: WebGLTexture, sx: number, sy: number, dx: number, dy: number, width: number, height: number): void => {
    gl.bindFramebuffer(gl.READ_FRAMEBUFFER, sourceFramebuffer);
    gl.bindTexture(gl.TEXTURE_2D, destination);
    gl.copyTexSubImage2D(gl.TEXTURE_2D, 0, dx, dy, sx, sy, width, height);
  };
  const withRawGl = (work: () => void): void => withRendererState(renderer, () => {
    try { work(); } finally { gl.bindFramebuffer(gl.READ_FRAMEBUFFER, null); renderer.resetState(); }
  });

  const record = (rect: TexelRect, kinds: readonly JournalKind[]): void => {
    if (open === null || open.overflow) return;
    const stroke = open;
    withRawGl(() => {
      for (const kind of kinds) {
        const target = painter.journalTarget(kind);
        if (target === null) continue;
        const liveFramebuffer = glFramebufferOf(renderer, target);
        for (let ty = Math.floor(rect.y0 / tile); ty <= Math.floor((rect.y1 - 1) / tile); ty += 1) {
          for (let tx = Math.floor(rect.x0 / tile); tx <= Math.floor((rect.x1 - 1) / tile); tx += 1) {
            const index = ty * tilesAcross + tx;
            if (stroke.saved[kind].has(index)) continue;
            const slot = allocateSlot(kind);
            if (slot === null) { stroke.overflow = true; return; }
            const at = tileOrigin(index);
            const place = slotOrigin(slot);
            copyRegion(liveFramebuffer, pages[kind][place.page]!.texture, at.x, at.y, place.x, place.y, at.width, at.height);
            stroke.saved[kind].set(index, slot);
          }
        }
      }
    });
  };

  const swap = (entry: Entry): void => {
    withRawGl(() => {
      for (const kind of KINDS) {
        if (entry[kind].length === 0) continue;
        const target = painter.journalTarget(kind)!;
        const liveFramebuffer = glFramebufferOf(renderer, target);
        const liveTexture = glTextureOf(renderer, target.texture);
        const spare = (scratch[kind] ??= createPage(kind, tile, tile));
        for (const saved of entry[kind]) {
          const at = tileOrigin(saved.tile);
          const place = slotOrigin(saved.slot);
          const page = pages[kind][place.page]!;
          copyRegion(liveFramebuffer, spare.texture, at.x, at.y, 0, 0, at.width, at.height); // live -> scratch
          copyRegion(page.framebuffer, liveTexture, place.x, place.y, at.x, at.y, at.width, at.height); // slot -> live
          copyRegion(spare.framebuffer, page.texture, 0, 0, place.x, place.y, at.width, at.height); // scratch -> slot
        }
      }
    });
    let slopeRect: TexelRect | null = null;
    for (const saved of entry.slope) {
      const at = tileOrigin(saved.tile);
      slopeRect = unionRect(slopeRect, { x0: at.x, y0: at.y, x1: at.x + at.width, y1: at.y + at.height });
    }
    if (slopeRect !== null) painter.recomposeNormal(slopeRect);
  };

  painter.setBeforeDraw(record);

  return {
    beginStroke: () => {
      for (const entry of redoEntries) freeEntry(entry); // a new stroke drops Redo (R21)
      redoEntries = [];
      open = emptyStroke();
    },
    record,
    endStroke: () => {
      const stroke = open;
      open = null;
      if (stroke === null) return { kept: true };
      const entry = emptyEntry();
      for (const kind of KINDS) for (const [tileIndex, slot] of stroke.saved[kind]) entry[kind].push({ tile: tileIndex, slot });
      if (stroke.overflow) {
        freeEntry(entry);
        for (const older of undoEntries) freeEntry(older); // older entries would swap tiles this stroke changed beyond repair
        undoEntries = [];
        return { kept: false };
      }
      if (KINDS.some((kind) => entry[kind].length > 0)) undoEntries.push(entry);
      return { kept: true };
    },
    undo: () => {
      if (open !== null) return false;
      const entry = undoEntries.pop();
      if (entry === undefined) return false;
      swap(entry);
      redoEntries.push(entry);
      return true;
    },
    redo: () => {
      if (open !== null) return false;
      const entry = redoEntries.pop();
      if (entry === undefined) return false;
      swap(entry);
      undoEntries.push(entry);
      return true;
    },
    canUndo: () => open === null && undoEntries.length > 0,
    canRedo: () => open === null && redoEntries.length > 0,
    stats: () => {
      const slotsInUse = { albedo: 0, orm: 0, height: 0, slope: 0 };
      for (const entry of [...undoEntries, ...redoEntries, ...(open === null ? [] : [openAsEntry(open)])]) for (const kind of KINDS) slotsInUse[kind] += entry[kind].length;
      return { undoEntries: undoEntries.length, redoEntries: redoEntries.length, slotsInUse, allocatedBytes };
    },
    dispose: () => {
      painter.setBeforeDraw(null);
      for (const page of [...KINDS.flatMap((kind) => pages[kind]), ...Object.values(scratch)]) { gl.deleteFramebuffer(page.framebuffer); gl.deleteTexture(page.texture); }
    },
  };
}

function openAsEntry(stroke: OpenStroke): Entry {
  const entry = emptyEntry();
  for (const kind of KINDS) for (const [tile, slot] of stroke.saved[kind]) entry[kind].push({ tile, slot });
  return entry;
}
