import { existsSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { SOURCE_ALIASES } from '../../../vite.config';
import { findForbiddenReach } from '../../../scripts/split/importGraph';

const entry = path.resolve(__dirname, '../../../src/materialgen/entry/main.tsx');
const forbidden = ['@shared/projection', '@shared/meshEdit', '@shared/app'];

describe('shared/materialgen-prep R6 entry reach', () => {
  it.skipIf(!existsSync(entry))('R6 the material app never reaches projection, meshEdit or app code', () => {
    const report = findForbiddenReach(entry, forbidden, SOURCE_ALIASES);
    const chains = report.reached.map((hit) => hit.chain.map((file) => path.relative(process.cwd(), file)).join(' -> '));
    expect(chains).toEqual([]);
    expect(report.unresolved).toEqual([]);
  });
});
