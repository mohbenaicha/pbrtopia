import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const TOKENS = { panel: 1, gutter: 2, popover: 10, loading: 20, brand: 30, setup: 50, dialog: 100, 'dialog-stacked': 110 } as const; // export R44: a dialog opened from inside another

// The stylesheets (and the one inline style) of the cross-component stack: each must take its z-index from a token.
const USERS: Record<string, keyof typeof TOKENS> = {
  'src/ui-kit/Dialog.css': 'dialog',
  'src/ui-kit/Popover.css': 'popover',
  'src/ui-kit/Select.css': 'popover',
  'src/ui-kit/LoadingOverlay.css': 'loading',
  'src/shell/AppShell.css': 'panel',
  'src/shell/PanelGutter.css': 'gutter',
  'src/generation/ui/assignment/AssignmentOverlay.css': 'setup',
  'src/shell/BrandMark.tsx': 'brand',
};

describe('viewport-layout layers', () => {
  const tokens = readFileSync('src/ui-kit/tokens.css', 'utf8');

  it('R38 tokens.css names every layer with its number', () => {
    for (const [name, value] of Object.entries(TOKENS)) expect(tokens).toMatch(new RegExp(`--layer-${name}:\\s*${value};`));
  });

  it('R44 a stacked dialog sits above a dialog and below the tooltip layer', () => {
    expect(TOKENS['dialog-stacked']).toBeGreaterThan(TOKENS.dialog);
    expect(tokens).toMatch(/--layer-tooltip:\s*200;/);
    expect(TOKENS['dialog-stacked']).toBeLessThan(200);
    expect(readFileSync('src/ui-kit/Dialog.css', 'utf8')).toMatch(/\[data-stacked\][^{]*\{[^}]*z-index:\s*var\(--layer-dialog-stacked\)/);
  });

  it('R38 the dialog is the topmost layer and the brand mark sits below the setup overlay and every dialog', () => {
    expect(TOKENS.dialog).toBeGreaterThan(TOKENS.setup);
    expect(TOKENS.setup).toBeGreaterThan(TOKENS.brand);
    expect(TOKENS.brand).toBeGreaterThan(TOKENS.loading);
    expect(TOKENS.loading).toBeGreaterThan(TOKENS.popover);
    expect(TOKENS.popover).toBeGreaterThan(TOKENS.gutter);
    expect(TOKENS.gutter).toBeGreaterThan(TOKENS.panel);
  });

  it.each(Object.entries(USERS))('R38 %s takes its z-index from --layer-%s, never a number', (path, layer) => {
    const text = readFileSync(path, 'utf8');
    const declarations = path.endsWith('.tsx') ? text.match(/zIndex:[^\n]*/g) : text.match(/^\s*z-index:[^;]*/gm);
    expect(declarations).not.toBeNull();
    for (const declaration of declarations!) {
      expect(declaration).toContain(`var(--layer-`);
      expect(declaration).not.toMatch(/(?:z-index|zIndex):\s*'?-?\d/);
    }
    expect(text).toContain(`--layer-${layer}`);
  });
});
