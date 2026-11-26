import { readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const src = path.resolve(__dirname, '../../src');
const sources = (directory: string): string[] => readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
  const full = path.join(directory, entry.name);
  return entry.isDirectory() ? sources(full) : /\.tsx?$/.test(entry.name) ? [full] : [];
});

describe('reference-editor R19 the timing harness is development only', () => {
  it('R19 nothing under src/ imports the harness or anything from tests/', () => {
    const importing = sources(src).filter((file) => /from\s+['"][^'"]*(tests\/|referenceEditorHarness)/.test(readFileSync(file, 'utf8')));
    expect(importing).toEqual([]);
  });
});
