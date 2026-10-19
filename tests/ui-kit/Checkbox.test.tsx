// @vitest-environment jsdom
import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { Button, Checkbox } from '../../src/ui-kit';

afterEach(cleanup);

describe('Checkbox', () => {
  it('R22 it is a labelled checkbox that reports whether it is checked', () => {
    const { rerender } = render(<Checkbox label="Select all" checked={false} onChange={() => undefined} />);
    expect((screen.getByRole('checkbox', { name: 'Select all' }) as HTMLInputElement).checked).toBe(false);
    rerender(<Checkbox label="Select all" checked onChange={() => undefined} />);
    expect((screen.getByRole('checkbox', { name: 'Select all' }) as HTMLInputElement).checked).toBe(true);
  });

  it('R22 a click on the box or on its visible label reports the opposite value', async () => {
    const onChange = vi.fn();
    render(<Checkbox label="Select all" checked={false} onChange={onChange} />);
    await userEvent.click(screen.getByRole('checkbox', { name: 'Select all' }));
    await userEvent.click(screen.getByText('Select all'));
    expect(onChange).toHaveBeenCalledTimes(2);
    expect(onChange).toHaveBeenCalledWith(true);
  });

  it('R22 the space key flips it from the keyboard', async () => {
    const onChange = vi.fn();
    render(<Checkbox label="Select Orc" checked onChange={onChange} />);
    screen.getByRole('checkbox', { name: 'Select Orc' }).focus();
    await userEvent.keyboard(' ');
    expect(onChange).toHaveBeenCalledWith(false);
  });

  it('R22 a disabled checkbox cannot be changed', async () => {
    const onChange = vi.fn();
    render(<Checkbox label="Select Orc" checked={false} onChange={onChange} disabled />);
    await userEvent.click(screen.getByRole('checkbox', { name: 'Select Orc' }));
    expect(onChange).not.toHaveBeenCalled();
  });

  it('R22 a hidden label stays the accessible name but is not drawn as text', () => {
    render(<Checkbox label="Select Orc" checked={false} onChange={() => undefined} hideLabel />);
    expect(screen.getByRole('checkbox', { name: 'Select Orc' })).toBeTruthy();
    expect(screen.queryByText('Select Orc')).toBeNull();
  });
});

describe('Button danger variant', () => {
  it('R22 a danger button is marked as danger and still works like a button', async () => {
    const onClick = vi.fn();
    render(<Button variant="danger" onClick={onClick}>Delete</Button>);
    const button = screen.getByRole('button', { name: 'Delete' });
    expect(button.getAttribute('data-variant')).toBe('danger');
    await userEvent.click(button);
    expect(onClick).toHaveBeenCalledTimes(1);
  });
});
