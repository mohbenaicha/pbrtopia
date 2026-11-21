import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const PURE = ['findIslands', 'measureUpTurn', 'rasterizeIslandMask', 'packPieces', 'readTexelBilinear', 'isUvInsidePicture', 'buildUprightSheet', 'deriveNormals', 'unpackNormals', 'uprightTypes'];
const read = (name: string): string => readFileSync(`src/generation/normal/${name}.ts`, 'utf8');

describe('the island and height-to-normal functions are pure (normal-map R20)', () => {
  it.each(PURE)('normal-map R20 %s imports nothing at run time but the other pure functions', (name) => {
    const imports = read(name).split('\n').filter((line) => /^import\s/.test(line) && !/^import\s+type\s/.test(line));
    for (const line of imports) expect(line).toMatch(new RegExp(`from '\\./(${PURE.join('|')})'`));
  });

  it.each(PURE)('normal-map R20 %s touches no DOM, canvas, GPU or store global', (name) => {
    expect(read(name)).not.toMatch(/\b(document|window|navigator|OffscreenCanvas|HTMLCanvasElement|WebGL\w*|GPUDevice|indexedDB|localStorage|Math\.random|Date\.now|performance\.now)\b/);
  });
});
