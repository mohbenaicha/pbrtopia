import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { SOURCE_ALIASES } from '../../vite.config';
import { findIsolationViolations } from './materialgenIsolation';

const ALLOWED = ['ui-kit', 'keys', 'generation', 'projects', 'viewport', 'shell', 'appId', 'storage-desktop'];
let root = '';
const aliases = () => ({ '@shared': path.join(root, 'src'), '@mat': path.join(root, 'src', 'materialgen') });

function write(relativePath: string, text: string): void {
  const full = path.join(root, relativePath);
  mkdirSync(path.dirname(full), { recursive: true });
  writeFileSync(full, text);
}
const violationsOf = (): string[] =>
  findIsolationViolations(path.join(root, 'src'), ALLOWED, aliases()).map((item) => `${item.file}: ${item.rule}`);

beforeEach(() => {
  root = mkdtempSync(path.join(tmpdir(), 'isolation-'));
  write('src/ui-kit/index.ts', 'export const a = 1;');
  write('src/ui-kit/Button.ts', 'export const b = 1;');
  write('src/projection/x.ts', 'export const x = 1;');
  write('src/materialgen/maps/index.ts', 'export const m = 1;');
});
afterEach(() => {
  rmSync(root, { recursive: true, force: true });
});

describe('shared/materialgen-prep R7 isolation', () => {
  it('R7 accepts an allowed @shared barrel and @mat imports inside materialgen', () => {
    write('src/materialgen/use.ts', "import '@shared/ui-kit'; import '@mat/maps'; import './maps';");
    expect(violationsOf()).toEqual([]);
  });

  it('R7 rejects a file outside materialgen that imports @mat or a path into materialgen', () => {
    write('src/projection/a.ts', "import '@mat/maps';");
    write('src/projection/b.ts', "import '../materialgen/maps';");
    expect(violationsOf().sort()).toEqual([
      'src/projection/a.ts: outside-imports-materialgen',
      'src/projection/b.ts: outside-imports-materialgen',
    ]);
  });

  it('R7 rejects a materialgen file that leaves materialgen with a relative path', () => {
    write('src/materialgen/a.ts', "import '../ui-kit';");
    expect(violationsOf()).toEqual(['src/materialgen/a.ts: leaves-materialgen']);
  });

  it('R7 rejects @shared folders projection, meshEdit, app and any not in the allow-list', () => {
    write('src/materialgen/a.ts', "import '@shared/projection/x'; import '@shared/meshEdit'; import '@shared/app';");
    expect(violationsOf().map((item) => item.split(': ')[1])).toEqual([
      'shared-folder-not-allowed',
      'shared-folder-not-allowed',
      'shared-folder-not-allowed',
    ]);
  });

  it('R7 rejects a deep import into an allowed @shared folder (index barrel only)', () => {
    write('src/materialgen/a.ts', "import '@shared/ui-kit/Button';");
    expect(violationsOf()).toEqual(['src/materialgen/a.ts: shared-folder-not-barrel']);
  });
});

describe('shared/materialgen-prep R7 this repository', () => {
  it('R7 the real source tree keeps the material app isolated', () => {
    const src = path.resolve(SOURCE_ALIASES['@shared']);
    expect(findIsolationViolations(src, ALLOWED, SOURCE_ALIASES)).toEqual([]);
  });
});
