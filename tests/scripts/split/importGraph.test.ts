import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { collectBarePackages, findForbiddenReach, listImportSpecifiers } from '../../../scripts/split/importGraph';

let root = '';
const aliases = () => ({ '@shared': path.join(root, 'src'), '@mat': path.join(root, 'src', 'materialgen') });
const forbidden = ['@shared/projection', '@shared/meshEdit', '@shared/app'];

function write(relativePath: string, text: string): string {
  const full = path.join(root, relativePath);
  mkdirSync(path.dirname(full), { recursive: true });
  writeFileSync(full, text);
  return full;
}
const rel = (file: string): string => path.relative(root, file).split(path.sep).join('/');

beforeEach(() => {
  root = mkdtempSync(path.join(tmpdir(), 'import-graph-'));
});
afterEach(() => {
  rmSync(root, { recursive: true, force: true });
});

describe('shared/materialgen-prep R4 import extraction', () => {
  it('R4 lists static, type-only, re-export and string-literal dynamic imports and ignores nothing else', () => {
    const source = [
      "import a from './a';",
      "import type { B } from '../b';",
      "export { c } from '@shared/ui-kit';",
      "export * from './d';",
      "const lazy = () => import('./e');",
      "import 'react';",
    ].join('\n');
    expect(listImportSpecifiers(source, 'x.ts').sort()).toEqual(
      ['../b', './a', './d', './e', '@shared/ui-kit', 'react'].sort(),
    );
  });
});

describe('shared/materialgen-prep R4 R5 findForbiddenReach', () => {
  it('R5 a clean fixture reaches nothing and has no unresolved import', () => {
    write('src/ui-kit/index.ts', "export * from './Button';");
    write('src/ui-kit/Button.ts', "import 'react'; export const Button = 1;");
    const entry = write('src/materialgen/entry/main.tsx', "import { Button } from '@shared/ui-kit'; export { Button };");
    const report = findForbiddenReach(entry, forbidden, aliases());
    expect(report.reached).toEqual([]);
    expect(report.unresolved).toEqual([]);
  });

  it('R5 a reach through two barrels returns the chain entry -> barrel -> barrel -> file', () => {
    write('src/viewport/index.ts', "export * from './inner';");
    write('src/viewport/inner/index.ts', "export * from './hidden';");
    write('src/viewport/inner/hidden.ts', "import { x } from '../../meshEdit/model/hiddenMarks'; export { x };");
    write('src/meshEdit/model/hiddenMarks.ts', 'export const x = 1;');
    const entry = write('src/materialgen/entry/main.tsx', "export * from '@shared/viewport';");
    const report = findForbiddenReach(entry, forbidden, aliases());
    expect(report.reached.map((hit) => hit.chain.map(rel))).toEqual([
      [
        'src/materialgen/entry/main.tsx',
        'src/viewport/index.ts',
        'src/viewport/inner/index.ts',
        'src/viewport/inner/hidden.ts',
        'src/meshEdit/model/hiddenMarks.ts',
      ],
    ]);
  });

  it('R4 follows type-only imports, re-exports, dynamic imports and the @mat alias', () => {
    write('src/projection/engine/a.ts', 'export const a = 1;');
    write('src/app/b.ts', 'export const b = 1;');
    write('src/meshEdit/c.ts', 'export const c = 1;');
    write('src/materialgen/maps/index.ts', "export type { A } from '@shared/projection/engine/a';");
    write('src/materialgen/lazy.ts', "export const load = () => import('../app/b');");
    const entry = write(
      'src/materialgen/entry/main.tsx',
      "import type { Z } from '@mat/maps'; import('@mat/lazy'); import type { C } from '../../meshEdit/c';",
    );
    const reached = findForbiddenReach(entry, forbidden, aliases()).reached.map((hit) => rel(hit.file)).sort();
    expect(reached).toEqual(['src/app/b.ts', 'src/meshEdit/c.ts', 'src/projection/engine/a.ts']);
  });

  it('R4 ends on an import cycle and reports each file once', () => {
    write('src/projection/p.ts', 'export const p = 1;');
    write('src/materialgen/a.ts', "import './b'; import '../projection/p';");
    write('src/materialgen/b.ts', "import './a'; import '../projection/p';");
    const entry = write('src/materialgen/entry/main.tsx', "import '../a'; import '../b';");
    const report = findForbiddenReach(entry, forbidden, aliases());
    expect(report.reached.map((hit) => rel(hit.file))).toEqual(['src/projection/p.ts']);
  });

  it('R4 reports an import that resolves to no file instead of skipping it, and ignores bare packages', () => {
    const entry = write('src/materialgen/entry/main.tsx', "import 'react'; import './missing'; import '@shared/nowhere';");
    const report = findForbiddenReach(entry, forbidden, aliases());
    expect(report.unresolved.map((item) => item.specifier).sort()).toEqual(['./missing', '@shared/nowhere']);
  });

  it('app R49 collectBarePackages lists each package once, reduced to its name, for files reachable from the entry only', () => {
    write('src/shared.ts', "import { create } from 'zustand'; import 'three/examples/jsm/loaders/GLTFLoader.js'; export const a = create;");
    write('src/materialgen/deep.ts', "import type { X } from '@scope/pkg/sub/path'; import fs from 'node:fs'; export type { X }; export { fs };");
    write('src/unreached.ts', "import 'never-used';");
    const entry = write(
      'src/materialgen/entry/main.tsx',
      "import react from 'react'; import { a } from '@shared/shared'; import '../deep'; import * as three from 'three'; export { react, a, three };",
    );
    expect(collectBarePackages(entry, aliases())).toEqual(['@scope/pkg', 'react', 'three', 'zustand']);
  });

  it('R4 treats an existing css or raw asset as a leaf and does not walk it', () => {
    write('src/materialgen/style.css', "@import 'x';");
    write('src/materialgen/shader.glsl', 'void main() {}');
    const entry = write('src/materialgen/entry/main.tsx', "import '../style.css'; import s from '../shader.glsl?raw'; export { s };");
    const report = findForbiddenReach(entry, forbidden, aliases());
    expect(report.reached).toEqual([]);
    expect(report.unresolved).toEqual([]);
  });
});
