import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

function listFiles(folder: string, extensions: string[]): string[] {
  return readdirSync(folder, { withFileTypes: true }).flatMap((entry) => {
    const path = join(folder, entry.name);
    if (entry.isDirectory()) return listFiles(path, extensions);
    return extensions.some((extension) => entry.name.endsWith(extension)) ? [path.replaceAll('\\', '/')] : [];
  });
}

const COLOUR_LITERAL = /#[0-9a-fA-F]{3,8}\b|\brgba?\(|\bhsla?\(/;

describe('style literals', () => {
  it('R21 no hex, rgb or hsl colour literal in any .css or .tsx under src/ outside ui-kit/tokens.css', () => {
    const offenders = listFiles('src', ['.css', '.tsx'])
      .filter((path) => path !== 'src/ui-kit/tokens.css')
      .filter((path) => COLOUR_LITERAL.test(readFileSync(path, 'utf8')));
    expect(offenders).toEqual([]);
  });

  it('R1 no ui-kit stylesheet draws a border or an outline other than the keyboard focus ring', () => {
    const offenders: string[] = [];
    for (const path of listFiles('src/ui-kit', ['.css'])) {
      readFileSync(path, 'utf8').split('\n').forEach((line, index) => {
        const declaration = /^\s*(border|outline)(?!-radius|-offset)(-[a-z]+)?\s*:\s*([^;]+);/.exec(line);
        if (!declaration) return;
        const value = declaration[3]!.trim();
        const isNone = value === 'none' || value === '0';
        const isFocusRing = declaration[1] === 'outline' && /var\(--focus-ring\)/.test(value);
        if (!isNone && !isFocusRing) offenders.push(`${path}:${index + 1}: ${line.trim()}`);
      });
    }
    expect(offenders).toEqual([]);
  });
});
