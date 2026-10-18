// @vitest-environment jsdom
import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { Toggle } from '../../src/ui-kit';

afterEach(cleanup);

describe('Toggle', () => {
  it('R22 it is a labelled switch that reports whether it is on', () => {
    const { rerender } = render(<Toggle label="Wireframe" checked={false} onChange={() => undefined} />);
    expect(screen.getByRole('switch', { name: 'Wireframe' }).getAttribute('aria-checked')).toBe('false');
    rerender(<Toggle label="Wireframe" checked onChange={() => undefined} />);
    expect(screen.getByRole('switch', { name: 'Wireframe' }).getAttribute('aria-checked')).toBe('true');
  });

  it('R22 a click on the switch or its label reports the opposite value', async () => {
    const onChange = vi.fn();
    render(<Toggle label="Wireframe" checked={false} onChange={onChange} />);
    await userEvent.click(screen.getByRole('switch', { name: 'Wireframe' }));
    await userEvent.click(screen.getByText('Wireframe'));
    expect(onChange).toHaveBeenCalledTimes(2);
    expect(onChange).toHaveBeenNthCalledWith(1, true);
    expect(onChange).toHaveBeenNthCalledWith(2, true);
  });

  it('R22 the space key flips it from the keyboard', async () => {
    const onChange = vi.fn();
    render(<Toggle label="Wireframe" checked onChange={onChange} />);
    screen.getByRole('switch', { name: 'Wireframe' }).focus();
    await userEvent.keyboard(' ');
    expect(onChange).toHaveBeenCalledWith(false);
  });

  it('R22 a disabled switch cannot be changed and shows its hint as a tooltip', async () => {
    const onChange = vi.fn();
    render(<Toggle label="Background" checked={false} onChange={onChange} disabled hint="The built-in studio has no backdrop" />);
    const toggle = screen.getByRole('switch', { name: 'Background' }) as HTMLInputElement;
    expect(toggle.disabled).toBe(true);
    await userEvent.click(toggle);
    expect(onChange).not.toHaveBeenCalled();
    expect(screen.getByText('Background').closest('label')!.getAttribute('title')).toBe('The built-in studio has no backdrop');
  });
});
