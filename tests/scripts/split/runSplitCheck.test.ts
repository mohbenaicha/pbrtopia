import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { findNestedInstall, runSplitCheck } from '../../../scripts/split/runSplitCheck';

let root = '';
function write(relativePath: string, text: string): string {
  const full = path.join(root, relativePath);
  mkdirSync(path.dirname(full), { recursive: true });
  writeFileSync(full, text);
  return full;
}
const manifestText = (dependencies: Record<string, string>): string => JSON.stringify({ dependencies, devDependencies: {} });
const aliases = () => ({ '@shared': path.join(root, 'src'), '@mat': path.join(root, 'src', 'materialgen') });

function options(manifest: Record<string, string>, upstream: Record<string, string>) {
  write('package.json', manifestText(manifest));
  write('upstream/package.json', manifestText(upstream));
  const entry = write('src/materialgen/entry/main.tsx', "import 'react'; import 'three';");
  return { repoRoot: root, entry, aliases: aliases(), manifestPath: path.join(root, 'package.json'), upstreamManifestPath: path.join(root, 'upstream', 'package.json') };
}

beforeEach(() => {
  root = mkdtempSync(path.join(tmpdir(), 'split-check-'));
});
afterEach(() => {
  rmSync(root, { recursive: true, force: true });
});

describe('materialgen/app R49 runSplitCheck', () => {
  it('R49 reports nothing when the packages reached from the entry match both manifests', () => {
    const deps = { react: '19.3.1', three: '0.170.0' };
    expect(runSplitCheck(options(deps, deps))).toEqual([]);
  });

  it('R49 names the missing and the mismatched packages', () => {
    const problems = runSplitCheck(options({ react: '19.3.1' }, { react: '19.3.0', three: '0.170.0' }));
    expect(problems).toEqual([
      'missing: three is imported but not declared in package.json',
      'mismatch: react is 19.3.1 here but 19.3.0 upstream',
    ]);
  });
});

describe('materialgen/app R50 findNestedInstall', () => {
  it('R50 passes when the upstream folder does not exist', () => {
    expect(findNestedInstall(root)).toEqual([]);
  });

  it('R50 passes when the upstream folder exists without node_modules', () => {
    mkdirSync(path.join(root, 'upstream'));
    expect(findNestedInstall(root)).toEqual([]);
  });

  it('R50 fails and names upstream/node_modules when it exists', () => {
    mkdirSync(path.join(root, 'upstream', 'node_modules'), { recursive: true });
    expect(findNestedInstall(root)).toEqual(['nested install: upstream/node_modules exists; delete it and install once at the root']);
  });

  it('R50 runSplitCheck includes the nested install problem', () => {
    const deps = { react: '19.3.1', three: '0.170.0' };
    const given = options(deps, deps);
    mkdirSync(path.join(root, 'upstream', 'node_modules'), { recursive: true });
    expect(runSplitCheck(given)).toEqual(['nested install: upstream/node_modules exists; delete it and install once at the root']);
  });
});
