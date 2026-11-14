// One-off: converts the Materialize brush atlas JPEG (10 x 20 tiles of 196 px, RGB) into the checked-in single-channel PNG the splat painter loads
// (compositing A10). Every tile is repacked into a 208 px cell with a 6 px gutter of its own edge pixels on each side, so filtering and mips never read a neighbour.
// Usage: node scripts/materialgen/prepareBrushAtlas.mjs <path to brush_atlas.jpeg>
import sharp from 'sharp';
import { mkdirSync } from 'node:fs';
import { dirname } from 'node:path';

const COLUMNS = 10;
const ROWS = 20;
const TILE = 196;
const GUTTER = 6;
const CELL = TILE + 2 * GUTTER;
const OUTPUT = 'src/materialgen/compositing/atlas/brush_atlas.png';
const BLACK_CLIP = 8; // JPEG noise near pure black or white is snapped to it
const WHITE_CLIP = 247;

const source = process.argv[2];
if (!source) throw new Error('Usage: node scripts/materialgen/prepareBrushAtlas.mjs <brush_atlas.jpeg>');

const { data, info } = await sharp(source).greyscale().raw().toBuffer({ resolveWithObject: true });
if (info.width !== COLUMNS * TILE || info.height !== ROWS * TILE) throw new Error(`Expected ${COLUMNS * TILE} x ${ROWS * TILE}, got ${info.width} x ${info.height}`);

const width = COLUMNS * CELL;
const height = ROWS * CELL;
const out = Buffer.alloc(width * height);
const clean = (value) => (value <= BLACK_CLIP ? 0 : value >= WHITE_CLIP ? 255 : Math.round(((value - BLACK_CLIP) * 255) / (WHITE_CLIP - BLACK_CLIP)));

for (let row = 0; row < ROWS; row += 1) {
  for (let column = 0; column < COLUMNS; column += 1) {
    for (let y = 0; y < CELL; y += 1) {
      const sourceY = row * TILE + Math.min(Math.max(y - GUTTER, 0), TILE - 1);
      for (let x = 0; x < CELL; x += 1) {
        const sourceX = column * TILE + Math.min(Math.max(x - GUTTER, 0), TILE - 1);
        out[(row * CELL + y) * width + column * CELL + x] = clean(data[sourceY * info.width + sourceX]);
      }
    }
  }
}

mkdirSync(dirname(OUTPUT), { recursive: true });
await sharp(out, { raw: { width, height, channels: 1 } }).toColourspace('b-w').png({ compressionLevel: 9 }).toFile(OUTPUT);
console.log(`${OUTPUT}: ${width} x ${height}, ${COLUMNS} x ${ROWS} tiles, cell ${CELL}, inset ${GUTTER / CELL}`);
