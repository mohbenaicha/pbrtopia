// @vitest-environment jsdom
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { AppShell } from '../../src/shell/AppShell';

afterEach(cleanup);

const panels = { widths: { left: 300, right: 300 }, resize: vi.fn(), commit: vi.fn(), reset: vi.fn(), limits: () => ({ min: 200, max: 600 }) };

const shell = (locked?: boolean) => <AppShell panels={panels} topBar={<button>top</button>} left={<button>left</button>} viewport={<div>view</div>} right={<button>right</button>} {...(locked === undefined ? {} : { locked })} />;

describe('AppShell (custom R30)', () => {
  it('custom R30 locked makes the top bar and the left panel inert and leaves the viewport and the right panel to their own rules', () => {
    render(shell(true));
    expect(screen.getByTestId('shell-top').hasAttribute('inert')).toBe(true);
    expect(screen.getByTestId('shell-left').hasAttribute('inert')).toBe(true);
    expect(screen.getByTestId('shell-viewport').hasAttribute('inert')).toBe(false);
    expect(screen.getByTestId('shell-right').hasAttribute('inert')).toBe(false);
  });

  it('custom R30 not locked, nothing is inert', () => {
    render(shell());
    expect(document.querySelector('[inert]')).toBeNull();
  });
});
