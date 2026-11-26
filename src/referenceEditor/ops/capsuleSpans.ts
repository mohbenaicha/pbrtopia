import type { Point } from '../model/geometry';

export interface Segment { from: Point; to: Point; first: boolean }
export type EmitSpan = (y: number, xa: number, xb: number) => void;

/** Largest k with 4*k*k <= m, exact (m >= 0, integer). */
function halfRoot(m: number): number {
  let root = Math.floor(Math.sqrt(m));
  while (root * root > m) root -= 1;
  while ((root + 1) * (root + 1) <= m) root += 1;
  return Math.floor(root / 2);
}

// Half-width of the disc of `size` at vertical offset dy (0..floor(size/2)): the pixels with 4*(dx^2+dy^2) <= size^2. Cached for the last size (architecture D4).
let cachedSize = -1;
let cachedTable = new Uint16Array(0);
function discTable(size: number): Uint16Array {
  if (size === cachedSize) return cachedTable;
  const reach = size >> 1;
  const table = new Uint16Array(reach + 1);
  for (let dy = 0; dy <= reach; dy += 1) table[dy] = halfRoot(size * size - 4 * dy * dy);
  cachedSize = size;
  cachedTable = table;
  return table;
}

/** Exact coverage test of the data-model rule: 4*d^2 <= size^2 with d the distance from (x, y) to the segment a-b. */
function covers(x: number, y: number, ax: number, ay: number, sx: number, sy: number, len2: number, size2: number): boolean {
  const px = x - ax;
  const py = y - ay;
  if (len2 === 0) return 4 * (px * px + py * py) <= size2;
  const dot = px * sx + py * sy;
  if (dot <= 0) return 4 * (px * px + py * py) <= size2;
  if (dot >= len2) return 4 * ((px - sx) * (px - sx) + (py - sy) * (py - sy)) <= size2;
  const cross = px * sy - py * sx;
  return 4 * cross * cross <= size2 * len2;
}

/**
 * Calls `emit(y, xa, xb)` once or twice per row for the pixels of the swept disc (capsule) of `seg`, clipped to width x height.
 * The capsule is convex, so each row is one interval; a segment that is not the first of its stroke leaves out the disc already
 * written at `seg.from` (so a stroke writes only new pixels). Cost: O(rows) plus the emitted pixels.
 */
export function capsuleSpans(seg: Segment, size: number, width: number, height: number, emit: EmitSpan): void {
  const { from, to } = seg;
  if (!seg.first && from.x === to.x && from.y === to.y) return;
  const table = discTable(size);
  const reach = size >> 1;
  const ax = from.x;
  const ay = from.y;
  const sx = to.x - ax;
  const sy = to.y - ay;
  const len2 = sx * sx + sy * sy;
  const size2 = size * size;
  const radius = size / 2;
  const slack = Math.sqrt(len2) * radius;
  const yMin = Math.max(0, Math.min(ay, to.y) - reach);
  const yMax = Math.min(height - 1, Math.max(ay, to.y) + reach);
  for (let y = yMin; y <= yMax; y += 1) {
    let lo = Infinity;
    let hi = -Infinity;
    const dyA = Math.abs(y - ay);
    if (dyA <= reach) { lo = ax - table[dyA]!; hi = ax + table[dyA]!; }
    const dyB = Math.abs(y - to.y);
    if (dyB <= reach) { lo = Math.min(lo, to.x - table[dyB]!); hi = Math.max(hi, to.x + table[dyB]!); }
    if (len2 > 0) {
      // body: |cross| <= radius*len and 0 <= dot <= len2, both linear in x for this row
      const py = y - ay;
      let bLo = -Infinity;
      let bHi = Infinity;
      if (sy !== 0) {
        const a = ax + (py * sx - slack) / sy;
        const b = ax + (py * sx + slack) / sy;
        bLo = Math.max(bLo, Math.min(a, b));
        bHi = Math.min(bHi, Math.max(a, b));
      } else if (Math.abs(py * sx) > slack) { bLo = Infinity; bHi = -Infinity; }
      if (sx !== 0) {
        const a = ax - (py * sy) / sx;
        const b = ax + (len2 - py * sy) / sx;
        bLo = Math.max(bLo, Math.min(a, b));
        bHi = Math.min(bHi, Math.max(a, b));
      } else if (py * sy < 0 || py * sy > len2) { bLo = Infinity; bHi = -Infinity; }
      if (bLo <= bHi) { lo = Math.min(lo, bLo); hi = Math.max(hi, bHi); }
    }
    if (lo > hi) continue;
    let xa = Math.max(0, Math.ceil(lo - 1e-6));
    let xb = Math.min(width - 1, Math.floor(hi + 1e-6));
    while (xa <= xb && !covers(xa, y, ax, ay, sx, sy, len2, size2)) xa += 1;
    while (xb >= xa && !covers(xb, y, ax, ay, sx, sy, len2, size2)) xb -= 1;
    if (xa > xb) continue;
    if (seg.first || dyA > reach) { emit(y, xa, xb); continue; }
    // leave out the disc already written at `from`; it lies inside the capsule interval
    const da = Math.max(xa, ax - table[dyA]!);
    const db = Math.min(xb, ax + table[dyA]!);
    if (da > xb || db < xa) { emit(y, xa, xb); continue; }
    if (da > xa) emit(y, xa, da - 1);
    if (db < xb) emit(y, db + 1, xb);
  }
}
