import type { PixelImage } from '@mat/maps';
import type { PackedLayout, TileRect } from '../layout/chooseLayout';

/** R47: the aspect of a returned image may differ from its canvas by this share, and a tile must have at least this many returned pixels per side (proposal). */
export const ASPECT_TOLERANCE = 0.01;
export const MIN_RETURNED_TILE_PX = 64;

const gcd = (a: number, b: number): number => (b === 0 ? a : gcd(b, a % b));

/** The aspect of a canvas in words for a message: "2:1", "16:9", or a decimal "3.11:1" when no small ratio fits. */
export function describeAspect(width: number, height: number): string {
  const divisor = gcd(width, height);
  const [w, h] = [width / divisor, height / divisor];
  return w <= 32 && h <= 32 ? `${w}:${h}` : `${(width / height).toFixed(2)}:1`;
}

/** "Image 2 (Normal)": the name an error and the log give an image (R47, R54). */
export const labelImage = (position: number, mapNames: readonly string[]): string => `Image ${position}${mapNames.length > 0 ? ` (${mapNames.join(', ')})` : ''}`;

/** R47: a message when the returned size does not suit the canvas, else null. The label is the image's, e.g. "Image 2 (Normal)". */
export function checkReturnedSize(label: string, layout: PackedLayout, returnedWidth: number, returnedHeight: number): string | null {
  const { canvas } = layout;
  const ratio = returnedWidth / returnedHeight / (canvas.width / canvas.height);
  if (Math.abs(ratio - 1) > ASPECT_TOLERANCE) return `${label}: the returned image is not ${describeAspect(canvas.width, canvas.height)}.`;
  const tilePx = Math.floor(layout.tileSide * Math.min(returnedWidth / canvas.width, returnedHeight / canvas.height));
  if (tilePx < MIN_RETURNED_TILE_PX) return `${label}: the returned image is too small (${returnedWidth} x ${returnedHeight}), each map would be ${tilePx} px.`;
  return null;
}

export interface CropRect {
  x: number;
  y: number;
  width: number;
  height: number;
}

/** R48, R49: where a tile lies in the returned image: its cell as a fraction of the canvas applied to the returned size, no inset; nothing beyond the image. A lone map is the whole image. */
export function computeTileCrop(tile: TileRect, layout: PackedLayout, returnedWidth: number, returnedHeight: number): CropRect {
  if (layout.tiles.length === 1) return { x: 0, y: 0, width: returnedWidth, height: returnedHeight };
  const { canvas } = layout;
  const left = Math.round((tile.x / canvas.width) * returnedWidth);
  const top = Math.round((tile.y / canvas.height) * returnedHeight);
  const right = Math.round(((tile.x + tile.width) / canvas.width) * returnedWidth);
  const bottom = Math.round(((tile.y + tile.height) / canvas.height) * returnedHeight);
  const x = Math.max(0, left);
  const y = Math.max(0, top);
  return { x, y, width: Math.max(0, Math.min(returnedWidth, right) - x), height: Math.max(0, Math.min(returnedHeight, bottom) - y) };
}

function cropPixels(image: PixelImage, rect: CropRect): PixelImage {
  const { channels } = image;
  const data = new Uint8Array(rect.width * rect.height * channels);
  for (let row = 0; row < rect.height; row += 1) {
    const from = ((rect.y + row) * image.width + rect.x) * channels;
    data.set(image.data.subarray(from, from + rect.width * channels), row * rect.width * channels);
  }
  return { width: rect.width, height: rect.height, channels, data };
}

export type SplitOutcome = { ok: true; tiles: PixelImage[] } | { ok: false; message: string };

/**
 * R47-R49, R53: validates a returned image against its layout and cuts one tile per map, in the order of the layout's tiles. All tiles or none: a tile that
 * cannot be cut fails the image. The tiles keep their native cut size; the maps module scales them to S when it places them (maps R12).
 */
export function splitReturnedImage(label: string, layout: PackedLayout, image: PixelImage): SplitOutcome {
  const problem = checkReturnedSize(label, layout, image.width, image.height);
  if (problem !== null) return { ok: false, message: problem };
  const tiles: PixelImage[] = [];
  for (const tile of layout.tiles) {
    const rect = computeTileCrop(tile, layout, image.width, image.height);
    if (rect.width < 1 || rect.height < 1) return { ok: false, message: `${label}: a map could not be cut from the returned image.` };
    tiles.push(cropPixels(image, rect));
  }
  return { ok: true, tiles };
}
