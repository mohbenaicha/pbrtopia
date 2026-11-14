// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { IconButton, TOOLTIP_DELAY_MS } from '@shared/ui-kit';
import { describeTooltipOf } from '../support/tooltipDescription';

beforeEach(() => vi.useFakeTimers());
afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

const icon = <svg aria-hidden="true" />;
const hover = (element: Element): void => {
  const event = new Event('pointerover', { bubbles: true });
  Object.defineProperty(event, 'pointerType', { value: 'mouse' });
  act(() => void element.dispatchEvent(event));
  act(() => void vi.advanceTimersByTime(TOOLTIP_DELAY_MS));
};

describe('ui-kit IconButton tooltip (app tooltips R2 R3 R4 R7)', () => {
  it('R3 hovering opens the styled tooltip: the label as heading and the hint as text; the accessible name stays the label', () => {
    render(<IconButton label="Crop" hint="Cuts every map to the area you pick." icon={icon} onClick={() => undefined} />);
    const button = screen.getByRole('button', { name: 'Crop' });
    expect(button.getAttribute('title')).toBeNull(); // R2: no native title beside it
    hover(button);
    const tip = screen.getByRole('tooltip');
    expect(tip.textContent).toContain('Crop');
    expect(tip.textContent).toContain('Cuts every map to the area you pick.');
    expect(describeTooltipOf(button)).toBe('Crop. Cuts every map to the area you pick.');
  });

  it('R3 R4 a disabled button still opens its tooltip, and the text is the reason it is disabled', () => {
    render(<IconButton label="Paint" hint="Paint on the maps." disabled disabledReason="Add a map first" icon={icon} onClick={() => undefined} />);
    const button = screen.getByRole('button', { name: 'Paint' });
    hover(button);
    expect(screen.getByRole('tooltip').textContent).toContain('Add a map first');
    expect(screen.getByRole('tooltip').textContent).not.toContain('Paint on the maps.');
    expect(describeTooltipOf(button)).toContain('Add a map first');
  });

  it('R7 a button with no hint and no reason gets the heading alone, with no description node', () => {
    render(<IconButton label="Close" icon={icon} onClick={() => undefined} />);
    const button = screen.getByRole('button', { name: 'Close' });
    expect(button.getAttribute('aria-describedby')).toBeNull();
    hover(button);
    expect(screen.getByRole('tooltip').textContent).toBe('Close');
  });

  it('R3 untitled: a button inside an outer tooltip has none of its own', () => {
    render(<IconButton untitled label="Invert shape 1" icon={icon} onClick={() => undefined} />);
    const button = screen.getByRole('button', { name: 'Invert shape 1' });
    hover(button);
    expect(screen.queryByRole('tooltip')).toBeNull();
    expect(button.getAttribute('title')).toBeNull();
    expect(button.getAttribute('aria-describedby')).toBeNull();
  });

  it('R4 the stylesheet sends a disabled button\'s pointer to its wrapper (jsdom has no layout; the hover is checked once in the app)', () => {
    const css = readFileSync(resolve(__dirname, '../../src/ui-kit/IconButton.css'), 'utf8');
    expect(css).toMatch(/\.ui-icon-button__tip > \.ui-icon-button:disabled\s*\{[^}]*pointer-events:\s*none/);
  });

  it('R3 a click still reaches the handler, and a loading button ignores it', () => {
    const onClick = vi.fn();
    const { rerender } = render(<IconButton label="Crop" icon={icon} onClick={onClick} />);
    fireEvent.click(screen.getByRole('button', { name: 'Crop' }));
    expect(onClick).toHaveBeenCalledTimes(1);
    rerender(<IconButton label="Crop" icon={icon} loading onClick={onClick} />);
    fireEvent.click(screen.getByRole('button', { name: 'Crop' }));
    expect(onClick).toHaveBeenCalledTimes(1);
  });
});
