import { SQUARE_SHAPE } from '../plan/planStamps';

/**
 * Compositing R43, A15: the plain square has no atlas tile, so a stamp's shape flag (the float both shaders already carry for Invert: 0 as drawn, 1 inverted) takes
 * this third value, "full coverage". The TS side writes it through `shapeFlagOf` and both shaders read it through `shapeCoverageGlsl`, so the contract has one name.
 */
export const SQUARE_COVERAGE = 2;

/** The shape flag of a stamp: SQUARE_COVERAGE for the square, 1 for an inverted shape, 0 otherwise. */
export const shapeFlagOf = (stamp: { shape: number; invert: boolean }): number => (stamp.shape === SQUARE_SHAPE ? SQUARE_COVERAGE : stamp.invert ? 1 : 0);

/** The GLSL expression of a stamp's shape coverage from the tile's alpha (`shape`) and its flag: full for the square, else the tile or its inverse. */
export const shapeCoverageGlsl = (shape: string, flag: string): string => `${flag} > ${SQUARE_COVERAGE - 0.5} ? 1.0 : mix(${shape}, 1.0 - ${shape}, ${flag})`;

/** The atlas grid: `columns x rows` equal cells, each tile shrunk by `inset` (fraction of the cell, per side) so filtering never reads a neighbour (R5, A10). */
export interface AtlasGrid {
  columns: number;
  rows: number;
  inset: number;
}

export interface TileRect {
  u0: number;
  v0: number;
  du: number;
  dv: number;
}

/** Whole-texel rectangle, x1 and y1 exclusive. */
export interface TexelRect {
  x0: number;
  y0: number;
  x1: number;
  y1: number;
}

/** Compositing A10: the atlas rectangle of a tile index, row-major from the top-left cell. */
export function tileRect(grid: AtlasGrid, index: number): TileRect {
  const cellU = 1 / grid.columns;
  const cellV = 1 / grid.rows;
  const column = index % grid.columns;
  const row = Math.floor(index / grid.columns);
  return {
    u0: column * cellU + cellU * grid.inset,
    v0: row * cellV + cellV * grid.inset,
    du: cellU * (1 - 2 * grid.inset),
    dv: cellV * (1 - 2 * grid.inset),
  };
}

/**
 * Compositing R16, R28: the texels one stamp can touch, as one rectangle inside the picture. The reach is the half diagonal (a rotated square), plus a margin.
 * A stamp that wraps over an edge covers both sides, so its rectangle spans the picture on that axis (the cheap, safe bound for dirty rectangles).
 */
export function stampBounds(stamp: { x: number; y: number; size: number }, side: number, margin: number): TexelRect | null {
  const reach = (stamp.size * Math.SQRT2 * side) / 2 + margin;
  const axis = (centreFraction: number): [number, number] => {
    const centre = centreFraction * side;
    const low = Math.floor(centre - reach);
    const high = Math.ceil(centre + reach);
    if (low < 0 || high > side) return [0, side]; // crosses an edge: both sides (wrap)
    return [low, high];
  };
  const [x0, x1] = axis(wrapUnit(stamp.x));
  const [y0, y1] = axis(wrapUnit(stamp.y));
  return x1 > x0 && y1 > y0 ? { x0, y0, x1, y1 } : null;
}

const wrapUnit = (value: number): number => value - Math.floor(value);

/** Compositing R28: the smallest rectangle holding both; null only when both are null. */
export function unionRect(a: TexelRect | null, b: TexelRect | null): TexelRect | null {
  if (a === null) return b;
  if (b === null) return a;
  return { x0: Math.min(a.x0, b.x0), y0: Math.min(a.y0, b.y0), x1: Math.max(a.x1, b.x1), y1: Math.max(a.y1, b.y1) };
}
