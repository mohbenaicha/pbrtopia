import { tilesAcross, tileRect, type Bounds, type Rect } from '../model/geometry';
import type { Raster } from '../model/raster';
import type { SelectionMask } from '../model/selectionMask';
import type { WriteRecorder } from '../model/writeRecorder';

/**
 * Memento of the tiles one command touched: each 64x64 tile is copied the first time it is about to be written (raster words, mask cells).
 * Applying the journal swaps the saved tiles with the live ones, so the same buffers serve undo and redo with no allocation.
 */
export interface TileJournal extends WriteRecorder {
  rasterTiles: Map<number, Uint32Array>;
  maskTiles: Map<number, Uint8Array>;
  /** Mask bounds before the command; exchanged with the live bounds on every swap. */
  boundsBefore: Bounds;
  bytes: number;
}

export function createTileJournal(raster: Raster, mask: SelectionMask): TileJournal {
  const across = tilesAcross(raster.width);
  const journal: TileJournal = {
    rasterTiles: new Map(),
    maskTiles: new Map(),
    boundsBefore: { ...mask.bounds },
    bytes: 0,
    touchRaster(x, y, w, h) {
      forEachTile(x, y, w, h, raster.width, raster.height, across, (index) => {
        if (journal.rasterTiles.has(index)) return;
        const rect = tileRect(index, raster.width, raster.height);
        const saved = new Uint32Array(rect.w * rect.h);
        copyOut(raster.words, raster.width, rect, saved);
        journal.rasterTiles.set(index, saved);
        journal.bytes += saved.byteLength;
      });
    },
    touchMask(x, y, w, h) {
      forEachTile(x, y, w, h, mask.width, mask.height, across, (index) => {
        if (journal.maskTiles.has(index)) return;
        const rect = tileRect(index, mask.width, mask.height);
        const saved = new Uint8Array(rect.w * rect.h);
        copyOut(mask.cells, mask.width, rect, saved);
        journal.maskTiles.set(index, saved);
        journal.bytes += saved.byteLength;
      });
    },
  };
  return journal;
}

function forEachTile(x: number, y: number, w: number, h: number, width: number, height: number, across: number, visit: (index: number) => void): void {
  const x0 = Math.max(0, x) >> 6;
  const x1 = Math.min(width - 1, x + w - 1) >> 6;
  const y0 = Math.max(0, y) >> 6;
  const y1 = Math.min(height - 1, y + h - 1) >> 6;
  for (let ty = y0; ty <= y1; ty += 1) for (let tx = x0; tx <= x1; tx += 1) visit(ty * across + tx);
}

function copyOut(live: Uint32Array | Uint8Array, width: number, rect: Rect, saved: Uint32Array | Uint8Array): void {
  let k = 0;
  for (let y = rect.y; y < rect.y + rect.h; y += 1) {
    const row = y * width + rect.x;
    for (let x = 0; x < rect.w; x += 1) saved[k++] = live[row + x]!;
  }
}

function swapTile(live: Uint32Array | Uint8Array, width: number, rect: Rect, saved: Uint32Array | Uint8Array): void {
  let k = 0;
  for (let y = rect.y; y < rect.y + rect.h; y += 1) {
    const row = y * width + rect.x;
    for (let x = 0; x < rect.w; x += 1) {
      const value = live[row + x]!;
      live[row + x] = saved[k]!;
      saved[k++] = value;
    }
  }
}

/** Exchanges every saved tile (and the bounds) with the live ones; calling it twice is the identity. Returns the touched tiles' rectangles. Cost: O(touched tiles x tile area). */
export function swapJournal(journal: TileJournal, raster: Raster, mask: SelectionMask): Rect[] {
  const dirty = new Map<number, Rect>();
  for (const [index, saved] of journal.rasterTiles) {
    const rect = tileRect(index, raster.width, raster.height);
    swapTile(raster.words, raster.width, rect, saved);
    dirty.set(index, rect);
  }
  for (const [index, saved] of journal.maskTiles) {
    const rect = tileRect(index, mask.width, mask.height);
    swapTile(mask.cells, mask.width, rect, saved);
    mask.tileHas[index] = 1; // the cells may be selected again; a superset flag is always safe
    dirty.set(index, rect);
  }
  const live = mask.bounds;
  mask.bounds = journal.boundsBefore;
  journal.boundsBefore = live;
  return [...dirty.values()];
}

export const isJournalEmpty = (journal: TileJournal): boolean => journal.rasterTiles.size === 0 && journal.maskTiles.size === 0;
