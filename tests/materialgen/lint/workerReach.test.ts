import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { SOURCE_ALIASES } from '../../../vite.config';
import { findForbiddenReach } from '../../../scripts/split/importGraph';

const worker = path.resolve(__dirname, '../../../src/materialgen/export/worker/exportWorker.ts');
// A worker has no document: a module that draws (React components, their CSS) or that reaches the shared UI kit fails when the worker starts (export R32).
const drawing = ['@mat/app', '@mat/masks/ui', '@shared/materialMasks/ui', '@mat/imageops/ui', '@shared/ui-kit', '@shared/shell'];

describe('materialgen/masks R24 R45 the masks worker reaches no drawing code', () => {
  it('R24 nothing the masks worker imports leads to a component, a stylesheet owner or the UI kit', () => {
    const report = findForbiddenReach(path.resolve(__dirname, '../../../src/materialMasks/worker/maskWorker.ts'), drawing, SOURCE_ALIASES);
    expect(report.reached.map((hit) => hit.chain.map((file) => path.relative(process.cwd(), file)).join(' -> '))).toEqual([]);
    expect(report.unresolved).toEqual([]);
  });

  it('R24 nothing the height worker (the job that stayed in materialgen) imports leads to drawing code', () => {
    const report = findForbiddenReach(path.resolve(__dirname, '../../../src/materialgen/masks/worker/heightWorker.ts'), drawing, SOURCE_ALIASES);
    expect(report.reached.map((hit) => hit.chain.map((file) => path.relative(process.cwd(), file)).join(' -> '))).toEqual([]);
    expect(report.unresolved).toEqual([]);
  });
});

describe('materialgen/maps R60 the PNG worker reaches no drawing code', () => {
  it('R60 nothing the PNG worker imports leads to a component, a stylesheet owner or the UI kit', () => {
    const report = findForbiddenReach(path.resolve(__dirname, '../../../src/materialgen/maps/png/worker/pngWorker.ts'), drawing, SOURCE_ALIASES);
    expect(report.reached.map((hit) => hit.chain.map((file) => path.relative(process.cwd(), file)).join(' -> '))).toEqual([]);
    expect(report.unresolved).toEqual([]);
  });
});

describe('materialgen/export R32 the export worker reaches no drawing code', () => {
  it('R32 nothing the worker imports leads to a component, a stylesheet owner or the UI kit', () => {
    const report = findForbiddenReach(worker, drawing, SOURCE_ALIASES);
    const chains = report.reached.map((hit) => hit.chain.map((file) => path.relative(process.cwd(), file)).join(' -> '));
    expect(chains).toEqual([]);
    expect(report.unresolved).toEqual([]);
  });
});
