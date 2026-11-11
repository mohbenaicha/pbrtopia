import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { describe, expect, it } from 'vitest';
import { compareStrictFlags, STRICT_FLAGS } from '../../../scripts/split/compareStrictFlags';
import { findNestedInstall } from '../../../scripts/split/runSplitCheck';
import rootViteConfig, { DEDUPED_PACKAGES as ROOT_DEDUPED } from '../../../vite.config';
import { DEDUPED_PACKAGES as ENTRY_DEDUPED } from '../../../src/materialgen/entry/vite.config';

const repoRoot = path.resolve(__dirname, '../../..');
const readJson = (file: string): { compilerOptions?: Record<string, unknown>; include?: string[]; scripts?: Record<string, string> } =>
  JSON.parse(readFileSync(path.join(repoRoot, file), 'utf8'));

describe('materialgen/app R48 strict flags of the tsconfig', () => {
  it('R48 the root tsconfig turns all four strict flags on', () => {
    const options = readJson('tsconfig.json').compilerOptions ?? {};
    expect(STRICT_FLAGS.filter((flag) => options[flag] !== true)).toEqual([]);
  });

  it.skipIf(!existsSync(path.join(repoRoot, 'upstream', 'tsconfig.json')))('R48 after the split the material tsconfig matches upstream/tsconfig.json', () => {
    expect(compareStrictFlags(readJson('tsconfig.json'), readJson('upstream/tsconfig.json'))).toEqual([]);
  });
});

describe('materialgen/app R49 check:split script', () => {
  it('R49 the root package.json has a check:split script that runs the split check', () => {
    expect(readJson('package.json').scripts?.['check:split']).toMatch(/scripts\/split\/checkSplit\.ts/);
  });
});

describe('materialgen/app R50 no nested install', () => {
  it('R50 the repository has no upstream/node_modules', () => {
    expect(findNestedInstall(repoRoot)).toEqual([]);
  });
});

describe('materialgen/app R51 dedupe list', () => {
  it('R51 the entry Vite config and the Vitest config dedupe the same packages', () => {
    expect([...ROOT_DEDUPED].sort()).toEqual([...ENTRY_DEDUPED].sort());
    expect(rootViteConfig.resolve?.dedupe).toEqual(ROOT_DEDUPED);
  });

  it('R51 the list names react, react-dom and three', () => {
    expect([...ENTRY_DEDUPED].sort()).toEqual(['react', 'react-dom', 'three']);
  });
});

describe('materialgen/app R52 config patterns for the upstream folder', () => {
  it('R52 ESLint ignores upstream/**', async () => {
    const loaded = (await import(/* @vite-ignore */ pathToFileURL(path.join(repoRoot, 'eslint.config.js')).href)) as { default: { ignores?: string[] }[] };
    const ignored = loaded.default.flatMap((entry) => entry.ignores ?? []);
    expect(ignored).toContain('upstream/**');
  });

  it('R52 Vitest excludes upstream/tests/**', () => {
    expect(rootViteConfig.test?.exclude).toContain('upstream/tests/**');
  });

  it('R52 the tsconfig include is exactly src and tests', () => {
    expect(readJson('tsconfig.json').include).toEqual(['src', 'tests']);
  });
});
