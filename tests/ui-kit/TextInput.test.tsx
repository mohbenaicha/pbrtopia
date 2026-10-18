// @vitest-environment jsdom
import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { TextInput } from '../../src/ui-kit';

afterEach(cleanup);

describe('TextInput', () => {
  it('R22 it is found by its label and reports typed text', async () => {
    const onChange = vi.fn();
    const user = userEvent.setup();
    render(<TextInput label="Password" value="" onChange={onChange} type="password" />);
    await user.type(screen.getByLabelText('Password'), 'a');
    expect(onChange).toHaveBeenCalledWith('a');
  });

  it('R22 an error message is tied to the input and marks it invalid', () => {
    render(<TextInput label="Password" value="x" onChange={() => undefined} error="Too short" />);
    const input = screen.getByLabelText('Password');
    expect(input.getAttribute('aria-invalid')).toBe('true');
    expect(input.getAttribute('aria-describedby')).toBe(screen.getByText('Too short').id);
  });

  it('R22 a hint is tied to the input and replaced by the error when there is one', () => {
    const { rerender } = render(<TextInput label="Key" value="" onChange={() => undefined} hint="Stays in this browser" />);
    expect(screen.getByLabelText('Key').getAttribute('aria-describedby')).toBe(screen.getByText('Stays in this browser').id);
    rerender(<TextInput label="Key" value="" onChange={() => undefined} hint="Stays in this browser" error="Required" />);
    expect(screen.queryByText('Stays in this browser')).toBeNull();
    expect(screen.getByLabelText('Key').getAttribute('aria-describedby')).toBe(screen.getByText('Required').id);
  });

  it('R22 a disabled input ignores typing and a read-only input keeps its value', async () => {
    const onChange = vi.fn();
    const user = userEvent.setup();
    render(
      <>
        <TextInput label="Locked" value="v" onChange={onChange} disabled />
        <TextInput label="Shown" value="v" onChange={onChange} readOnly />
      </>,
    );
    await user.type(screen.getByLabelText('Locked'), 'zz');
    await user.type(screen.getByLabelText('Shown'), 'zz');
    expect(onChange).not.toHaveBeenCalled();
  });
});
