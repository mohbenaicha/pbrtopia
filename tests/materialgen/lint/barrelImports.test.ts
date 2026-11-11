import { readdirSync, readFileSync, statSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { listImportSpecifiers } from '../../../scripts/split/importGraph';

const materialRoot = path.resolve(__dirname, '../../../src/materialgen');
// entry and data are not folders others import from (app R1).
const FREE_FOLDERS = new Set(['entry', 'data']);

function sourceFiles(directory: string): string[] {
  return readdirSync(directory).flatMap((name) => {
    const full = path.join(directory, name);
    if (statSync(full).isDirectory()) return sourceFiles(full);
    return /\.tsx?$/.test(name) ? [full] : [];
  });
}

describe('materialgen/app R1 barrel imports', () => {
  it('R1 every materialgen folder except entry and data has an index.ts barrel', () => {
    const folders = readdirSync(materialRoot).filter((name) => statSync(path.join(materialRoot, name)).isDirectory() && !FREE_FOLDERS.has(name));
    const without = folders.filter((name) => !readdirSync(path.join(materialRoot, name)).includes('index.ts'));
    expect(without).toEqual([]);
  });

  it('R1 code outside a folder imports it through its barrel, never a deeper file', () => {
    const deep: string[] = [];
    for (const file of sourceFiles(materialRoot)) {
      const ownFolder = path.relative(materialRoot, file).split(path.sep)[0];
      for (const specifier of listImportSpecifiers(readFileSync(file, 'utf8'), file)) {
        const match = /^@mat\/([^/]+)\/.+/.exec(specifier);
        if (match && match[1] !== ownFolder) deep.push(`${path.relative(materialRoot, file)} -> ${specifier}`);
      }
    }
    expect(deep).toEqual([]);
  });
});
