import { tileRect, tilesAcross, tilesDown, type Rect } from '../model/geometry';

/** The 64x64 tiles that must be repainted: marked from any rectangle, drained once per animation frame (architecture D7). */
export class DirtyTiles {
  private flags: Uint8Array;
  private list: number[] = [];
  private across: number;
  private down: number;

  constructor(private width: number, private height: number) {
    this.across = tilesAcross(width);
    this.down = tilesDown(height);
    this.flags = new Uint8Array(this.across * this.down);
  }

  get isEmpty(): boolean { return this.list.length === 0; }

  /** The picture changed size: everything is dirty at the new size. */
  resize(width: number, height: number): void {
    this.width = width;
    this.height = height;
    this.across = tilesAcross(width);
    this.down = tilesDown(height);
    this.flags = new Uint8Array(this.across * this.down);
    this.list = [];
    this.markAll();
  }

  mark(rect: Rect): void {
    const x0 = Math.max(0, rect.x);
    const y0 = Math.max(0, rect.y);
    const x1 = Math.min(this.width - 1, rect.x + rect.w - 1);
    const y1 = Math.min(this.height - 1, rect.y + rect.h - 1);
    if (x0 > x1 || y0 > y1) return;
    for (let ty = y0 >> 6; ty <= y1 >> 6; ty += 1) {
      for (let tx = x0 >> 6; tx <= x1 >> 6; tx += 1) {
        const index = ty * this.across + tx;
        if (this.flags[index] === 0) { this.flags[index] = 1; this.list.push(index); }
      }
    }
  }

  markAll(): void { this.mark({ x: 0, y: 0, w: this.width, h: this.height }); }

  /** The marked tiles' rectangles, merged into as few rectangles as possible; clears the marks. */
  drain(): Rect[] {
    const tiles = this.list.sort((a, b) => a - b);
    for (const index of tiles) this.flags[index] = 0;
    this.list = [];
    return mergeTiles(tiles, this.width, this.height);
  }
}

/** Merges sorted tile indexes: neighbours in one tile row become one rectangle, and equal-width rows that touch become one taller rectangle. */
export function mergeTiles(sortedIndexes: readonly number[], width: number, height: number): Rect[] {
  const rows: Rect[] = [];
  for (const index of sortedIndexes) {
    const rect = tileRect(index, width, height);
    const last = rows[rows.length - 1];
    if (last !== undefined && last.y === rect.y && last.x + last.w === rect.x) last.w += rect.w;
    else rows.push(rect);
  }
  const merged: Rect[] = [];
  for (const row of rows) {
    const above = merged.find((rect) => rect.x === row.x && rect.w === row.w && rect.y + rect.h === row.y);
    if (above !== undefined) above.h += row.h;
    else merged.push(row);
  }
  return merged;
}
