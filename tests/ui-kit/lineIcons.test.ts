import { describe, expect, it } from 'vitest';
import { LINE_ICON_PATHS } from '../../src/ui-kit/lineIcons';

describe('LINE_ICON_PATHS', () => {
  it('viewport-layout R3 offers the icons the app draws with one line set', () => {
    expect(Object.keys(LINE_ICON_PATHS).sort()).toEqual(['check', 'chevron-down', 'chevron-right', 'close', 'gear', 'plus', 'reset']);
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
