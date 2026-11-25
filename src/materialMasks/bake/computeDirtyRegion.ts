import { NONE_LABEL } from '../quantise/classifyPixelsToPalette';

export const REGION_TILE = 128;

export interface DirtyRegion {
  tilesAcross: number;
  tile: number;
  bake: Uint8Array; // per tile, 1 = recompute its texels (the changed labels' texels and everything within the feather radius of them)
  fill: Uint8Array; // per tile, 1 = refill its gutter texels (the tiles to bake and every tile within the gutter reach of them)
  share: number; // the fraction of the tiles to bake
}

export interface RegionInput {
  labels: Uint8Array;
  side: number;
  rowCount: number; // rows in the table: a label at or above it reads row 0
  changedLabels: readonly number[];
  radius: number; // the feather radius, texels
  reach: number; // the gutter reach, texels; 0 when there is no coverage
  tile?: number;
}

/** The 8-neighbourhood of every flagged tile, flagged too. */
function grow(flags: Uint8Array, across: number): Uint8Array {
  const grown = new Uint8Array(flags.length);
  for (let row = 0; row < across; row += 1) {
    for (let column = 0; column < across; column += 1) {
      if (flags[row * across + column] !== 1) continue;
      for (let dy = -1; dy <= 1; dy += 1) {
        for (let dx = -1; dx <= 1; dx += 1) {
          const y = row + dy;
          const x = column + dx;
          if (y >= 0 && y < across && x >= 0 && x < across) grown[y * across + x] = 1;
        }
      }
    }
  }
  return grown;
}

/**
 * Mask-bake-session R7: the tiles a bake of `changedLabels` must recompute. A texel changes when its (effective) label changed: a label with no row reads row 0, and a 255 texel (no mask) is
 * never recomputed, so it never marks a tile. The feather blur reads the radius around each texel and the gutter fill copies from within the reach, so each is one tile of growth (a
 * superset, as the tile is wider than either). Null when the radius or the reach is wider than a tile: the caller then recomputes every texel.
 */
export function computeDirtyRegion({ labels, side, rowCount, changedLabels, radius, reach, tile = REGION_TILE }: RegionInput): DirtyRegion | null {
  if (radius > tile || reach > tile) return null;
  const changed = new Uint8Array(256);
  for (const label of changedLabels) changed[label] = 1;
  if (changed[0] === 1) for (let label = rowCount; label < 256; label += 1) if (label !== NONE_LABEL) changed[label] = 1;
  const across = Math.ceil(side / tile);
  const marked = new Uint8Array(across * across);
  for (let row = 0; row < side; row += 1) {
    const tileRow = Math.floor(row / tile) * across;
    for (let column = 0; column < side; column += 1) {
      if (changed[labels[row * side + column]!] === 1) marked[tileRow + Math.floor(column / tile)] = 1;
    }
  }
  const bake = radius > 0 ? grow(marked, across) : marked;
  const fill = reach > 0 ? grow(bake, across) : bake;
  return { tilesAcross: across, tile, bake, fill, share: bake.reduce((sum, flag) => sum + flag, 0) / bake.length };
}
