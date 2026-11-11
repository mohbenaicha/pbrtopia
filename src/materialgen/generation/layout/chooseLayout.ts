import { listCanvases, type Canvas, type CanvasRule } from '@shared/generation';

/** Generation R25: the smallest tile side a pack may have (a proposal of the spec). */
export const MIN_TILE_SIDE_PX = 256;

export interface GridShape {
  cols: number;
  rows: number;
}

/** R21: the grids allowed for k maps, in the order that breaks a tie (R23). There is no grid for more than three maps. */
const GRIDS_BY_COUNT: Readonly<Record<number, readonly GridShape[]>> = {
  1: [{ cols: 1, rows: 1 }],
  2: [{ cols: 2, rows: 1 }, { cols: 1, rows: 2 }],
  3: [{ cols: 3, rows: 1 }, { cols: 2, rows: 2 }],
};

/** One map's cell on the canvas, in canvas pixels. */
export interface TileRect {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface PackedLayout {
  grid: GridShape;
  canvas: Canvas;
  tileSide: number; // the shorter side of a cell (the shorter canvas side for a lone map)
  tiles: TileRect[]; // one cell per map, in the order the maps were given (reading order of the grid)
  emptyCells: number;
}

export type LayoutRefusal = 'no-canvas' | 'too-many-maps' | 'tiles-too-small';

export type LayoutChoice = { ok: true; layout: PackedLayout } | { ok: false; reason: LayoutRefusal; tileSide: number };

const gridName = ({ cols, rows }: GridShape): string => `${cols}x${rows}`;
export { gridName };

function placeGrid(canvas: Canvas, grid: GridShape, mapCount: number): PackedLayout {
  if (mapCount === 1) {
    return { grid, canvas, tileSide: Math.min(canvas.width, canvas.height), tiles: [{ x: 0, y: 0, width: canvas.width, height: canvas.height }], emptyCells: 0 };
  }
  const cellWidth = Math.floor(canvas.width / grid.cols); // equal cells that touch: no gap, margin or inset (R23, as Materialize)
  const cellHeight = Math.floor(canvas.height / grid.rows);
  const tiles: TileRect[] = [];
  for (let index = 0; index < mapCount; index += 1) {
    const column = index % grid.cols;
    const row = Math.floor(index / grid.cols);
    tiles.push({ x: column * cellWidth, y: row * cellHeight, width: cellWidth, height: cellHeight });
  }
  return { grid, canvas, tileSide: Math.min(cellWidth, cellHeight), tiles, emptyCells: grid.cols * grid.rows - mapCount };
}

/** The squarest canvas wins for a lone map; at equal shape the bigger one (R23, third example). */
function squarest(canvases: readonly Canvas[]): Canvas | null {
  let best: Canvas | null = null;
  let bestSkew = Infinity;
  for (const canvas of canvases) {
    const skew = Math.abs(Math.log(canvas.width / canvas.height));
    if (skew < bestSkew - 1e-9 || (Math.abs(skew - bestSkew) <= 1e-9 && best !== null && canvas.width * canvas.height > best.width * best.height)) {
      best = canvas;
      bestSkew = skew;
    }
  }
  return best;
}

/**
 * Generation R14, R21-R25: the one function that decides how a card's maps are packed, used by the run and by the preview in the setup overlay. It tries every grid
 * allowed for the number of maps on every canvas the model offers at the resolution, and keeps the pair with the largest tile side; ties go to fewer empty cells,
 * then fewer canvas pixels, then the grid listed first. A pack whose tiles would be under the smallest side is refused (R25) but its measure is returned.
 */
export function chooseLayout(rule: CanvasRule | undefined, resolutionKey: string, mapCount: number): LayoutChoice {
  const grids = GRIDS_BY_COUNT[mapCount];
  if (grids === undefined) return { ok: false, reason: 'too-many-maps', tileSide: 0 };
  if (rule === undefined) return { ok: false, reason: 'no-canvas', tileSide: 0 };

  let best: PackedLayout | null = null;
  const better = (candidate: PackedLayout, current: PackedLayout): boolean => {
    if (candidate.tileSide !== current.tileSide) return candidate.tileSide > current.tileSide;
    if (candidate.emptyCells !== current.emptyCells) return candidate.emptyCells < current.emptyCells;
    return candidate.canvas.width * candidate.canvas.height < current.canvas.width * current.canvas.height;
  };

  if (mapCount === 1) {
    const canvas = squarest(listCanvases(rule, resolutionKey, 1));
    if (canvas !== null) best = placeGrid(canvas, grids[0]!, 1);
  } else {
    for (const grid of grids) {
      for (const canvas of listCanvases(rule, resolutionKey, grid.cols / grid.rows)) {
        const candidate = placeGrid(canvas, grid, mapCount);
        if (best === null || better(candidate, best)) best = candidate; // a later grid replaces only a strictly better one, so the first listed keeps a tie
      }
    }
  }
  if (best === null) return { ok: false, reason: 'no-canvas', tileSide: 0 };
  if (best.tileSide < MIN_TILE_SIDE_PX) return { ok: false, reason: 'tiles-too-small', tileSide: best.tileSide };
  return { ok: true, layout: best };
}
