// @vitest-environment jsdom
import { readFileSync } from 'node:fs';
import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { Tabs } from '../../src/ui-kit';

afterEach(cleanup);

const tabs = [
  { value: 'textures', label: 'Textures' },
  { value: 'uv', label: 'UV' },
  { value: 'projections', label: 'Projections', disabled: true },
];

describe('Tabs', () => {
  it('R22 it is a labelled tab list with the selected tab marked', () => {
    render(<Tabs label="Left panel" tabs={tabs} value="uv" onChange={() => undefined} />);
    expect(screen.getByRole('tablist', { name: 'Left panel' })).toBeTruthy();
    expect(screen.getByRole('tab', { name: 'UV' }).getAttribute('aria-selected')).toBe('true');
    expect(screen.getByRole('tab', { name: 'Textures' }).getAttribute('aria-selected')).toBe('false');
  });

  it('R22 clicking a tab reports its value', async () => {
    const onChange = vi.fn();
    render(<Tabs label="Left panel" tabs={tabs} value="textures" onChange={onChange} />);
    await userEvent.click(screen.getByRole('tab', { name: 'UV' }));
    expect(onChange).toHaveBeenCalledWith('uv');
  });

  it('R22 only the selected tab is in the tab order, and arrow keys move to the next enabled tab', async () => {
    const onChange = vi.fn();
    render(<Tabs label="Left panel" tabs={tabs} value="textures" onChange={onChange} />);
    expect(screen.getByRole('tab', { name: 'Textures' }).getAttribute('tabindex')).toBe('0');
    expect(screen.getByRole('tab', { name: 'UV' }).getAttribute('tabindex')).toBe('-1');
    screen.getByRole('tab', { name: 'Textures' }).focus();
    await userEvent.keyboard('{ArrowRight}');
    expect(onChange).toHaveBeenCalledWith('uv');
  });

  it('R22 a disabled tab ignores clicks', async () => {
    const onChange = vi.fn();
    render(<Tabs label="Left panel" tabs={tabs} value="textures" onChange={onChange} />);
    await userEvent.click(screen.getByRole('tab', { name: 'Projections' }));
    expect(onChange).not.toHaveBeenCalled();
  });
});

describe('Tabs browser-tab look', () => {
  const panelTabs = [
    { value: 'generate', label: 'Generate' },
    { value: 'debug', label: 'Debug', icon: 'bug' as const, iconOnly: true },
  ];

  it('R32 an icon-only tab draws the icon with no text, and keeps its label as tooltip and accessible name', () => {
    render(<Tabs label="Generate panel" tabs={panelTabs} value="generate" onChange={() => undefined} />);
    const debug = screen.getByRole('tab', { name: 'Debug' });
    expect(debug.getAttribute('title')).toBe('Debug');
    expect(debug.getAttribute('data-compact')).not.toBeNull();
    expect(debug.textContent).toBe('');
    expect(debug.querySelector('[data-icon="bug"]')).not.toBeNull();
  });

  it('R32 a plain text tab is not compact and keeps its text as its name', () => {
    render(<Tabs label="Generate panel" tabs={panelTabs} value="generate" onChange={() => undefined} />);
    const generate = screen.getByRole('tab', { name: 'Generate' });
    expect(generate.getAttribute('data-compact')).toBeNull();
    expect(generate.getAttribute('title')).toBeNull();
  });

  it('R32 a text tab that has an icon shows both the icon and its text', () => {
    render(<Tabs label="Panel" tabs={[{ value: 'a', label: 'Alpha', icon: 'grid' as const }]} value="a" onChange={() => undefined} />);
    const alpha = screen.getByRole('tab', { name: 'Alpha' });
    expect(alpha.textContent).toBe('Alpha');
    expect(alpha.querySelector('[data-icon="grid"]')).not.toBeNull();
    expect(alpha.getAttribute('title')).toBeNull();
  });

  it('R32 arrow keys still move between an icon-only tab and a text tab', async () => {
    const onChange = vi.fn();
    render(<Tabs label="Generate panel" tabs={panelTabs} value="generate" onChange={onChange} />);
    screen.getByRole('tab', { name: 'Generate' }).focus();
    await userEvent.keyboard('{ArrowRight}');
    expect(onChange).toHaveBeenCalledWith('debug');
  });

  it('R32 the stylesheet draws the curves from the --radius-tab token with no colour literal, and the token exists', () => {
    const css = readFileSync('src/ui-kit/Tabs.css', 'utf8');
    expect(css).toContain('var(--radius-tab)');
    expect(css).toContain('var(--bg-page)');
    expect(css).toContain('var(--bg-panel)');
    expect(css).toMatch(/radial-gradient/);
    expect(css).not.toMatch(/#[0-9a-fA-F]{3,8}\b|\brgba?\(/);
    expect(readFileSync('src/ui-kit/tokens.css', 'utf8')).toMatch(/--radius-tab:\s*\d+px/);
  });
});
