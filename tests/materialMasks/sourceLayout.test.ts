import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative, resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const SRC = resolve(process.cwd(), 'src');
const sourceFiles = (dir: string): string[] => readdirSync(dir).flatMap((name) => (statSync(join(dir, name)).isDirectory() ? sourceFiles(join(dir, name)) : /\.(ts|tsx)$/.test(name) ? [join(dir, name)] : []));

describe('material mask core layout (material-masks-core R4, R10)', () => {
  it('material-masks-core R4 the core imports no @mat path, defines PixelImage once, and the old worker api no longer defines it', () => {
    const core = sourceFiles(join(SRC, 'materialMasks'));
    expect(core.filter((file) => /from '@mat\//.test(readFileSync(file, 'utf8')))).toEqual([]);
    const defines = (file: string): boolean => /export interface PixelImage\b/.test(readFileSync(file, 'utf8'));
    expect(core.filter(defines).map((file) => relative(SRC, file).split('\\').join('/'))).toEqual(['materialMasks/imageTypes.ts']);
    expect(sourceFiles(join(SRC, 'materialgen', 'workerapi')).filter(defines)).toEqual([]);
  });

  it('material-masks-core R10 the shipped data files sit under materialMasks/data and the loaders reach them with import.meta.glob', () => {
    for (const file of ['base-materials.json', 'material-vectors.bin']) expect(existsSync(join(SRC, 'materialMasks', 'data', file)), file).toBe(true);
    expect(readFileSync(join(SRC, 'materialMasks', 'table', 'loadBaseMaterials.ts'), 'utf8')).toContain("import.meta.glob('../data/base-materials.json'");
    expect(readFileSync(join(SRC, 'materialMasks', 'table', 'loadMaterialVectors.ts'), 'utf8')).toContain("import.meta.glob('../data/material-vectors.bin'");
  });
});
