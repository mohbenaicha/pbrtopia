import { readdirSync, readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const FILES = [
  ...readdirSync('src/generation/normal/height').map((name) => `src/generation/normal/height/${name}`),
  'src/generation/normal/reauthor/reauthorFromHeight.ts',
  'src/generation/normal/reauthor/tailFromSlopes.ts',
];

describe('the height functions are pure (normal-height-edit R8)', () => {
  it.each(FILES)('normal-height-edit R8 %s touches no DOM, canvas, GPU, store or clock global and nothing random', (file) => {
    const code = readFileSync(file, 'utf8').replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, ''); // words in comments ("window" of a min/max filter) are not globals
    expect(code).not.toMatch(/\b(document|window|navigator|OffscreenCanvas|HTMLCanvasElement|WebGL\w*|GPUDevice|indexedDB|localStorage|Math\.random|Date\.now|performance\.now)\b/);
  });
});
