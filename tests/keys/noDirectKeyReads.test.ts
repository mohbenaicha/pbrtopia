import { readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

function sourceFiles(folder: string): string[] {
  return readdirSync(folder, { withFileTypes: true }).flatMap((entry) => {
    const full = path.join(folder, entry.name);
    if (entry.isDirectory()) return sourceFiles(full);
    return /\.(ts|tsx)$/.test(entry.name) ? [full] : [];
  });
}

describe('key reads (api-keys R25)', () => {
  it('TestR25_only_ProviderKeySource_reads_the_vault_for_a_key', () => {
    const readers = sourceFiles('src')
      .filter((file) => /\.getKey\(/.test(readFileSync(file, 'utf8')))
      .map((file) => path.relative('src', file).replaceAll('\\', '/'));
    expect(readers).toEqual(['keys/ProviderKeySource.ts']);
  });
});
