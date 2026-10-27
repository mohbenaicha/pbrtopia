import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const css = readFileSync('src/ui-kit/tokens.css', 'utf8');
const valueOf = (token: string): string | undefined => new RegExp(`--${token}:\\s*([^;]+);`).exec(css)?.[1]?.trim();

describe('tokens.css', () => {
  it('R2 defines every palette token with the specified value', () => {
    const palette: Record<string, string> = {
      'bg-page': '#0a0a0b',
      'bg-panel': '#101012',
      'bg-input': '#17171a',
      'bg-button': '#212125',
      'bg-hover': '#2b2b30',
      text: '#ece8e1',
      'text-dim': '#96928a',
      'text-hint': '#5f5c56',
      accent: '#f08a24',
      'accent-hover': '#ffa443',
      'accent-text': '#1b1005',
      number: '#d9a82e',
      error: '#ff7a66',
    };
    for (const [token, value] of Object.entries(palette)) expect(valueOf(token), token).toBe(value);
  });

  it('textures R2 and R3 define the active (green) and previous (blue) heading colours', () => {
    expect(valueOf('text-active')).toMatch(/^#[0-9a-f]{6}$/i);
    expect(valueOf('text-previous')).toMatch(/^#[0-9a-f]{6}$/i);
    expect(valueOf('text-active')).not.toBe(valueOf('text-previous'));
  });

  it('R2 defines the radii: control 8px, group 11px, dialog 14px, panel 0', () => {
    expect(valueOf('radius-control')).toBe('8px');
    expect(valueOf('radius-group')).toBe('11px');
    expect(valueOf('radius-dialog')).toBe('14px');
    expect(valueOf('radius-panel')).toBe('0');
  });

  it('R2 defines the font stack and the base size', () => {
    expect(valueOf('font')).toBe('"Segoe UI Variable Text", "Segoe UI", system-ui, sans-serif');
    expect(valueOf('font-size')).toBe('13.5px');
    expect(valueOf('line-height')).toBe('1.35');
  });
});
