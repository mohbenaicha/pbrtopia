// Masks R34, R75: builds the two shipped data files from Materialize's `working/embeddings` folder (run once, by hand).
//   node scripts/materialgen/buildMaterialData.mjs <embeddings folder> [output folder]
// Writes `base-materials.json` (name -> [roughness, metalness, [r, g, b]], the content of material_pbr_values.json.backup) and
// `material-vectors.bin` (the 384-number vector of each material as little-endian float16, in the file order of the names).
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';

const DIM = 384;
const [sourceDir, outputDir = 'src/materialMasks/data'] = process.argv.slice(2);
if (sourceDir === undefined) {
  console.error('Usage: node scripts/materialgen/buildMaterialData.mjs <embeddings folder> [output folder]');
  process.exit(1);
}

const floatView = new Float32Array(1);
const bitsView = new Uint32Array(floatView.buffer);

/** The IEEE half-precision bits of a number (round to nearest, ties to even; out-of-range values go to infinity). */
function toHalfBits(value) {
  floatView[0] = value;
  const bits = bitsView[0];
  const sign = (bits >>> 16) & 0x8000;
  const exponent = ((bits >>> 23) & 0xff) - 127 + 15;
  const fraction = bits & 0x7fffff;
  if (exponent >= 0x1f) return sign | 0x7c00;
  if (exponent <= 0) {
    if (exponent < -10) return sign;
    const shifted = (fraction | 0x800000) >>> (1 - exponent);
    return sign | ((shifted + 0xfff + ((shifted >>> 13) & 1)) >>> 13);
  }
  const dropped = fraction & 0x1fff;
  let half = (exponent << 10) | (fraction >>> 13);
  if (dropped > 0x1000 || (dropped === 0x1000 && (half & 1) === 1)) half += 1;
  return sign | half;
}

const table = JSON.parse(readFileSync(path.join(sourceDir, 'material_pbr_values.json.backup'), 'utf8'));
const full = JSON.parse(readFileSync(path.join(sourceDir, 'material_pbr_values.json'), 'utf8'));
const names = Object.keys(table);
if (names.length !== 1000) throw new Error(`Expected 1000 materials, found ${names.length}.`);
if (Object.keys(full).join('\n') !== names.join('\n')) throw new Error('The two files do not list the same materials in the same order.');

const bytes = new Uint8Array(names.length * DIM * 2);
const view = new DataView(bytes.buffer);
names.forEach((name, row) => {
  const vector = full[name][3];
  if (!Array.isArray(vector) || vector.length !== DIM) throw new Error(`${name}: expected a vector of ${DIM} numbers.`);
  vector.forEach((value, at) => view.setUint16((row * DIM + at) * 2, toHalfBits(value), true));
});

mkdirSync(outputDir, { recursive: true });
writeFileSync(path.join(outputDir, 'base-materials.json'), JSON.stringify(table));
writeFileSync(path.join(outputDir, 'material-vectors.bin'), bytes);
console.log(`${names.length} materials, ${bytes.byteLength} bytes of vectors written to ${outputDir}`);
