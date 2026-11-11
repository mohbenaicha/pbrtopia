// @vitest-environment jsdom
import { cleanup, render, screen, within } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { MaterialShortcutsSection, groupShortcuts } from '@mat/app/settings/MaterialShortcutsSection';
import { shortcutEntries, type ShortcutEntry } from '@mat/app/settings/shortcutMap';

afterEach(cleanup);

describe('materialgen/app shortcuts', () => {
  it('R44 the groups are Viewport, Editing and Dialogs and overlays, always in that order, even when one is empty', () => {
    const groups = groupShortcuts([]);
    expect(groups.map((group) => group.heading)).toEqual(['Viewport', 'Editing', 'Dialogs and overlays']);
    expect(groups.every((group) => group.entries.length === 0)).toBe(true);
  });

  it('R46 the table holds the viewport drag and wheel, Ctrl+Z, Esc and Enter, the setup overlay keys and the viewer gestures, and no redo', () => {
    const keys = shortcutEntries.map((entry) => entry.keys);
    for (const expected of ['Left drag', 'Wheel', 'Ctrl+Z (Cmd+Z)', 'Esc', 'Enter', 'Space', 'Arrow keys', 'Drag', 'Double-click']) expect(keys).toContain(expected);
    expect(shortcutEntries.some((entry) => /redo/i.test(entry.label))).toBe(false);
  });

  it('R46 the Viewport group names the Reset view corner icon', () => {
    const viewport = groupShortcuts(shortcutEntries).find((group) => group.heading === 'Viewport')!;
    expect(viewport.entries.map((entry) => entry.label)).toContain('Return the preview to its default pose and distance');
    expect(viewport.entries.find((entry) => entry.label.includes('default pose'))?.keys).toBe('Reset view icon');
  });

  it('R46a the section shows every table entry, and a new entry appears with no second edit', () => {
    const extra: ShortcutEntry = { id: 'probe', keys: 'Shift+P', label: 'A probe entry', scope: 'editing' };
    render(<MaterialShortcutsSection entries={[...shortcutEntries, extra]} />);
    for (const entry of [...shortcutEntries, extra]) {
      const row = screen.getAllByText(entry.label).find((node) => node.closest('li') !== null)?.closest('li');
      expect(row, entry.label).toBeTruthy();
      expect(within(row as HTMLElement).getByText(entry.keys)).toBeTruthy();
    }
    expect(screen.getAllByRole('listitem')).toHaveLength(shortcutEntries.length + 1);
  });
});
