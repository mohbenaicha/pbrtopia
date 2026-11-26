import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

// reference-editor architecture: dependency direction view -> (render, stroke, document, io, machine) -> (history, ops) -> model, and no framework in the core.
const ROOT = 'src/referenceEditor';
const filesOf = (dir: string): string[] => readdirSync(dir).flatMap((name) => { const path = join(dir, name); return statSync(path).isDirectory() ? filesOf(path) : [path]; });
const importsOf = (file: string): string[] => [...readFileSync(file, 'utf8').matchAll(/(?:from|import)\s+['"]([^'"]+)['"]/g)].map((match) => match[1]!);
const layerOf = (file: string): string => file.replace(/\\/g, '/').split('/')[2] ?? '';
const files = (): string[] => filesOf(ROOT).filter((file) => /\.tsx?$/.test(file));

const ALLOWED: Record<string, string[]> = {
  model: [],
  ops: ['model'],
  history: ['model'],
  document: ['model', 'history', 'ops'],
  machine: ['model'],
  stroke: ['model', 'ops', 'history', 'document', 'machine'],
  render: ['model'],
  io: ['model'],
  view: ['model', 'ops', 'history', 'document', 'machine', 'stroke', 'render', 'io'],
};

describe('referenceEditor layers (architecture.md, reference-editor R19)', () => {
  it('R19 the folder exists and every layer folder is one of the documented ones', () => {
    const layers = new Set(files().map(layerOf).filter((layer) => !layer.endsWith('.ts')));
    for (const layer of layers) expect(Object.keys(ALLOWED)).toContain(layer);
  });

  it('R19 each layer imports only the layers it may depend on', () => {
    for (const file of files()) {
      const layer = layerOf(file);
      if (!(layer in ALLOWED)) continue;
      for (const spec of importsOf(file).filter((s) => s.startsWith('.'))) {
        const resolved = join(file, '..', spec).replace(/\\/g, '/');
        if (!resolved.startsWith(`${ROOT}/`)) continue; // outside the editor (the ui-kit): checked by the next test
        const target = resolved.split('/')[2] ?? '';
        if (target === layer || target.endsWith('.ts') || target.endsWith('.tsx')) continue;
        expect(ALLOWED[layer], `${file} imports ${spec}`).toContain(target);
      }
    }
  });

  it('R19 the editor imports nothing from generation, projects, app or the stores', () => {
    for (const file of files()) for (const spec of importsOf(file)) expect(spec, file).not.toMatch(/\.\.\/(?:\.\.\/)*(generation|projects|app|shell)\b/);
  });

  it('R19 the core layers import neither React nor the DOM-bound layers', () => {
    for (const file of files().filter((f) => ['model', 'ops', 'history', 'document', 'machine'].includes(layerOf(f)))) {
      for (const spec of importsOf(file)) expect(spec, file).not.toMatch(/^react|react-dom/);
      expect(readFileSync(file, 'utf8'), file).not.toMatch(/\b(window|navigator|HTMLCanvasElement|OffscreenCanvas|requestAnimationFrame|createImageBitmap)\b/);
    }
  });

  it('R19 no module is longer than about 500 lines', () => {
    for (const file of files()) expect(readFileSync(file, 'utf8').split('\n').length, file).toBeLessThanOrEqual(500);
  });
});
