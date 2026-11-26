import type { MarkedView } from './markedView';
import { findSideFacing } from './objectSides';
import { STRIP_PX, writeOpaque } from './paintBackdrop';

const GLYPH_WIDTH = 5;
const GLYPH_HEIGHT = 7;
const GLYPH_GAP = 1;
const HEIGHT_SHARE = 0.08;
const MAX_SCALE = 8;
const MIN_HEIGHT_SHARE_OF_SHEET = 0.02;
const INSET_PX = 2;
const LETTER_COLOUR = 0xffffff;
const OUTLINE_COLOUR = 0x000000;

// 5 x 7 bitmaps with 2 px strokes, for the letters of the side table only.
const GLYPHS: Record<string, readonly string[]> = {
  F: ['#####', '#####', '##...', '####.', '####.', '##...', '##...'],
  B: ['####.', '##.##', '##.##', '####.', '##.##', '##.##', '####.'],
  L: ['##...', '##...', '##...', '##...', '##...', '#####', '#####'],
  R: ['####.', '##.##', '##.##', '####.', '####.', '##.##', '##.##'],
  T: ['#####', '#####', '.###.', '.###.', '.###.', '.###.', '.###.'],
  a: ['.....', '.....', '.###.', '...##', '.####', '##.##', '.####'],
  o: ['.....', '.....', '.###.', '##.##', '##.##', '##.##', '.###.'],
};

interface Square {
  x: number;
  y: number;
}

// The top-left corner of every lit square of the text, in unscaled glyph units.
function listLitSquares(text: string): Square[] {
  return [...text].flatMap((character, index) =>
    GLYPHS[character]!.flatMap((line, y) => [...line].flatMap((cell, x) => (cell === '#' ? [{ x: index * (GLYPH_WIDTH + GLYPH_GAP) + x, y }] : []))),
  );
}

function fillRect(pixels: Uint8ClampedArray, canvasWidth: number, x: number, y: number, side: number, colour: number): void {
  for (let row = y; row < y + side; row += 1) {
    for (let column = x; column < x + side; column += 1) writeOpaque(pixels, (row * canvasWidth + column) * 4, colour);
  }
}

const measureTextWidth = (text: string) => text.length * (GLYPH_WIDTH + GLYPH_GAP) - GLYPH_GAP; // unscaled
const computeOutline = (scale: number) => Math.max(1, Math.floor(scale / 2));

// The size the view asks for, never under the sheet's minimum (a thin tile on a large sheet stays readable), then the largest
// that fits between the strips; 0 when none does.
function chooseLetterScale(text: string, view: { w: number; h: number }, sheetSide: number): number {
  const ofView = Math.min(MAX_SCALE, Math.floor((HEIGHT_SHARE * Math.min(view.w, view.h)) / GLYPH_HEIGHT));
  const minimum = Math.ceil((MIN_HEIGHT_SHARE_OF_SHEET * sheetSide) / GLYPH_HEIGHT);
  for (let scale = Math.max(1, ofView, minimum); scale >= 1; scale -= 1) {
    const frame = 2 * (STRIP_PX + computeOutline(scale)) + INSET_PX; // both strips, the outline and the inset
    if (measureTextWidth(text) * scale + frame <= view.w && GLYPH_HEIGHT * scale + frame <= view.h) return scale;
  }
  return 0;
}

// R4: the letter of the side the view shows, in its top right corner inside the strips, over whatever is there.
export function paintViewLetter(pixels: Uint8ClampedArray, canvas: { width: number; height: number }, view: MarkedView): void {
  const { x, y, w } = view.content;
  const [rx, ry, rz] = view.right;
  const [ux, uy, uz] = view.up;
  // right x up points from the object to the camera: the side this view shows.
  const text = findSideFacing([ry * uz - rz * uy, rz * ux - rx * uz, rx * uy - ry * ux]).letter;
  const scale = chooseLetterScale(text, view.content, Math.max(canvas.width, canvas.height));
  if (scale === 0) return;

  const outline = computeOutline(scale);
  const margin = STRIP_PX + INSET_PX + outline;
  const originX = x + w - margin - measureTextWidth(text) * scale;
  const originY = y + margin;
  const squares = listLitSquares(text).map((square) => ({ x: originX + square.x * scale, y: originY + square.y * scale }));
  for (const square of squares) fillRect(pixels, canvas.width, square.x - outline, square.y - outline, scale + 2 * outline, OUTLINE_COLOUR);
  for (const square of squares) fillRect(pixels, canvas.width, square.x, square.y, scale, LETTER_COLOUR);
}
