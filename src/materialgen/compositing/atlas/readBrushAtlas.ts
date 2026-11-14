import type { AtlasGrid } from '../gpu/stampGeometry';
import { decodePng, isIndexedImage } from '@mat/maps/png/pngCodec';

/** Compositing R36: shown when the brush shapes cannot be read; the painter's entry is disabled with it. */
export const BRUSH_ATLAS_ERROR = 'The brush shapes could not be loaded.';

const COLUMNS = 10;
const ROWS = 20;
const CELL = 208; // 196 px of shape and a 6 px gutter of its own edge on each side (scripts/materialgen/prepareBrushAtlas.mjs)
const GUTTER = 6;

/** The atlas image's layout in pixels, for drawing one shape out of it (the pickers and swatches). */
export const ATLAS_LAYOUT = { columns: COLUMNS, rows: ROWS, cell: CELL, gutter: GUTTER, tile: CELL - 2 * GUTTER, width: COLUMNS * CELL, height: ROWS * CELL } as const;

/** Compositing A10: the 200 shapes of the one atlas, as the stamp painter takes them (one R8 image, rows top to bottom). */
export interface BrushAtlas {
  data: Uint8Array<ArrayBuffer>;
  width: number;
  height: number;
  grid: AtlasGrid;
  count: number;
}

export const BRUSH_GRID: AtlasGrid = { columns: COLUMNS, rows: ROWS, inset: GUTTER / CELL };

/** Compositing R36: the checked-in atlas PNG as a brush atlas; anything else than the expected single-channel image is an error. */
export function readBrushAtlas(bytes: Uint8Array): BrushAtlas {
  try {
    const image = decodePng(bytes);
    if (isIndexedImage(image) || image.channels !== 1 || image.width !== COLUMNS * CELL || image.height !== ROWS * CELL) throw new Error('unexpected atlas image');
    const data = new Uint8Array(image.data.length);
    data.set(image.data);
    return { data, width: image.width, height: image.height, grid: BRUSH_GRID, count: COLUMNS * ROWS };
  } catch {
    throw new Error(BRUSH_ATLAS_ERROR);
  }
}
