/** Edge of one history/render tile, in image pixels. */
export const TILE = 64;
const TILE_SHIFT = 6;

export interface Point { x: number; y: number }
export interface Rect { x: number; y: number; w: number; h: number }
/** Inclusive pixel box; empty when minX > maxX. */
export interface Bounds { minX: number; minY: number; maxX: number; maxY: number }

export const emptyBounds = (): Bounds => ({ minX: 1 << 30, minY: 1 << 30, maxX: -1, maxY: -1 });
export const isEmptyBounds = (bounds: Bounds): boolean => bounds.minX > bounds.maxX;
export const tilesAcross = (width: number): number => (width + TILE - 1) >> TILE_SHIFT;
export const tilesDown = (height: number): number => (height + TILE - 1) >> TILE_SHIFT;
export const tileIndexAt = (x: number, y: number, across: number): number => (y >> TILE_SHIFT) * across + (x >> TILE_SHIFT);

/** The image rectangle of tile `index`, clipped to the picture. */
export function tileRect(index: number, width: number, height: number): Rect {
  const across = tilesAcross(width);
  const x = (index % across) * TILE;
  const y = Math.floor(index / across) * TILE;
  return { x, y, w: Math.min(TILE, width - x), h: Math.min(TILE, height - y) };
}

export function unionRect(a: Rect | null, b: Rect | null): Rect | null {
  if (a === null) return b;
  if (b === null) return a;
  const x = Math.min(a.x, b.x);
  const y = Math.min(a.y, b.y);
  return { x, y, w: Math.max(a.x + a.w, b.x + b.w) - x, h: Math.max(a.y + a.h, b.y + b.h) - y };
}
