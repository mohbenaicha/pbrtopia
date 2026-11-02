import { describe, expect, it } from 'vitest';
import { LINE_ICON_PATHS } from '../../src/ui-kit/lineIcons';

describe('LINE_ICON_PATHS', () => {
  it('viewport-layout R3 offers the icons the app draws with one line set', () => {
    expect(Object.keys(LINE_ICON_PATHS).sort()).toEqual(['apply', 'arrow-right', 'bug', 'check', 'chevron-down', 'chevron-right', 'close', 'download', 'eye', 'gear', 'grid', 'model-download', 'pencil', 'plus', 'projects', 'reset', 'save', 'trash', 'upload']);
  });

  it('textures R6 and R16 offer the apply and model-download icons', () => {
    expect(LINE_ICON_PATHS.apply.length).toBeGreaterThan(0);
    expect(LINE_ICON_PATHS['model-download'].length).toBeGreaterThan(1);
  });

  it('viewport-layout R3 gives every icon at least one path that starts with a move command', () => {
    for (const [name, paths] of Object.entries(LINE_ICON_PATHS)) {
      expect(paths.length, name).toBeGreaterThan(0);
      for (const path of paths) expect(path, name).toMatch(/^M\s*-?\d/);
    }
  });

  it('viewport-layout R3 keeps every coordinate inside the 24x24 box', () => {
    for (const [name, paths] of Object.entries(LINE_ICON_PATHS)) {
      for (const path of paths) {
        const numbers = (path.match(/-?\d*\.?\d+/g) ?? []).map(Number);
        expect(numbers.every((value) => Math.abs(value) <= 24), name).toBe(true);
      }
    }
  });
});
