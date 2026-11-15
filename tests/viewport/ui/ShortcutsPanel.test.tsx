// @vitest-environment jsdom
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { ORBIT_SHORTCUTS, type ShortcutSet } from '../../../src/viewport/shortcutSet';
import { ShortcutsPanel } from '../../../src/viewport/ui/ShortcutsPanel';

afterEach(cleanup);

const SRC = resolve(__dirname, '../../../src');
const sheet = readFileSync(join(SRC, 'viewport/ui/ShortcutsPanel.css'), 'utf8');
const declarationsOf = (selector: string): string => {
  const escaped = selector.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const found = new RegExp(`(?:^|\\}|\\*/)\\s*${escaped}\\s*\\{([^}]*)\\}`).exec(sheet);
  if (found === null) throw new Error(`no rule for ${selector}`);
  return found[1]!;
};

const SAMPLE: ShortcutSet = { id: 'sample', entries: [{ keys: 'Alt + click', action: 'Set the marker' }, { keys: 'Esc', action: 'Clear it' }] };

describe('app/shortcuts the Shortcuts panel', () => {
  it('R1 it is headed Shortcuts, open at first, and closing it hides the rows and opening shows them again', () => {
    render(<ShortcutsPanel set={SAMPLE} />);
    const heading = screen.getByRole('button', { name: 'Shortcuts' });
    expect(heading.getAttribute('aria-expanded')).toBe('true');
    expect(screen.getByText('Set the marker')).toBeTruthy();
    fireEvent.click(heading);
    expect(heading.getAttribute('aria-expanded')).toBe('false');
    expect(screen.queryByText('Set the marker')).toBeNull();
    fireEvent.click(heading);
    expect(screen.getByText('Set the marker')).toBeTruthy();
  });

  it('R1 it stays in the free part of the viewport and is see-through', () => {
    const panel = declarationsOf('.shortcuts-panel');
    expect(panel).toMatch(/left:\s*calc\(var\(--stage-left,\s*0px\)\s*\+/);
    expect(panel).toMatch(/bottom:\s*calc\(var\(--stage-bottom,\s*0px\)\s*\+/);
    expect(declarationsOf('.shortcuts-panel .ui-disclosure')).toMatch(/opacity:\s*0\.\d+|color-mix\(/);
  });

  it('R3 every entry is a row with its keys and its action, in the order given', () => {
    render(<ShortcutsPanel set={SAMPLE} />);
    const rows = screen.getAllByRole('listitem');
    expect(rows.map((row) => row.textContent)).toEqual(['Alt + clickSet the marker', 'EscClear it']);
    expect(screen.getByText('Alt + click').tagName).toBe('KBD');
  });

  it('R3 a set with no entries draws no rows', () => {
    render(<ShortcutsPanel set={{ id: 'empty', entries: [] }} />);
    expect(screen.queryAllByRole('listitem')).toHaveLength(0);
  });

  it('R2 the orbit set is the old hint: right-drag orbit, middle-drag pan, scroll zoom', () => {
    render(<ShortcutsPanel set={ORBIT_SHORTCUTS} />);
    expect(screen.getAllByRole('listitem').map((row) => row.textContent)).toEqual(['Right-dragOrbit', 'Middle-dragPan', 'ScrollZoom']);
  });

  it('R4 the panel passes the pointer to the canvas; only its heading takes it', () => {
    expect(declarationsOf('.shortcuts-panel')).toMatch(/pointer-events:\s*none/);
    expect(declarationsOf('.shortcuts-panel .ui-disclosure__header')).toMatch(/pointer-events:\s*auto/);
  });

  it('R7 no viewport-hint class and no HintLine remain in src', () => {
    const offenders: string[] = [];
    const walk = (dir: string): void => {
      for (const name of readdirSync(dir)) {
        const path = join(dir, name);
        if (statSync(path).isDirectory()) walk(path);
        else if (/\.(tsx?|css)$/.test(name) && /viewport-hint|HintLine/.test(readFileSync(path, 'utf8'))) offenders.push(path);
      }
    };
    walk(SRC);
    expect(offenders).toEqual([]);
  });
});
