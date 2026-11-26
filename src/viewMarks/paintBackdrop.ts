import { classifyGridLines, MAJOR_LINE, MINOR_LINE } from './classifyGridLines';
import type { MarkedView } from './markedView';
import { findSideFacing } from './objectSides';

export const STRIP_PX = 4;
const MAJOR_COLOUR = 0x707070;
const MINOR_COLOUR = 0x4a4a4a;

const toRgbNumber = ([red, green, blue]: readonly [number, number, number]) => (red << 16) | (green << 8) | blue;

export function writeOpaque(pixels: Uint8ClampedArray, offset: number, colour: number): void {
  pixels[offset] = colour >> 16;
  pixels[offset + 1] = (colour >> 8) & 0xff;
  pixels[offset + 2] = colour & 0xff;
  pixels[offset + 3] = 255;
}

// R2, R3: the strips and the grid of one view, written only where nothing was rendered (alpha 0), so neither can cover the model.
export function paintViewBackdrop(pixels: Uint8ClampedArray, canvasWidth: number, view: MarkedView, options: { background: number; gridStep: number }): void {
  const { x, y, w, h } = view.content;
  const [uLeft, uRight] = view.across;
  const [vTop, vBottom] = view.down;
  const columns = classifyGridLines(uLeft, (uRight - uLeft) / w, w, options.gridStep);
  const rows = classifyGridLines(-vTop, (vTop - vBottom) / h, h, options.gridStep); // image rows run against `up`
  const negate = ([a, b, c]: MarkedView['up']) => [-a, -b, -c] as const;
  const top = toRgbNumber(findSideFacing(view.up).rgb);
  const bottom = toRgbNumber(findSideFacing(negate(view.up)).rgb);
  const right = toRgbNumber(findSideFacing(view.right).rgb);
  const left = toRgbNumber(findSideFacing(negate(view.right)).rgb);

  for (let row = 0; row < h; row += 1) {
    const rowStrip = row < STRIP_PX ? top : row >= h - STRIP_PX ? bottom : null;
    for (let column = 0; column < w; column += 1) {
      const offset = ((y + row) * canvasWidth + x + column) * 4;
      if (pixels[offset + 3] !== 0) continue;
      let colour = rowStrip ?? (column < STRIP_PX ? left : column >= w - STRIP_PX ? right : null);
      if (colour === null) {
        const line = Math.max(columns[column]!, rows[row]!);
        colour = line === MAJOR_LINE ? MAJOR_COLOUR : line === MINOR_LINE ? MINOR_COLOUR : options.background;
      }
      writeOpaque(pixels, offset, colour);
    }
  }
}

// Everything still unrendered takes the background, and the whole picture ends opaque.
export function fillBackground(pixels: Uint8ClampedArray, background: number): void {
  for (let offset = 0; offset < pixels.length; offset += 4) {
    if (pixels[offset + 3] === 0) writeOpaque(pixels, offset, background);
    else pixels[offset + 3] = 255;
  }
}
