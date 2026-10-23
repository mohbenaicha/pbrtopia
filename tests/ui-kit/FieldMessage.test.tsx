// @vitest-environment jsdom
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { describedBy, FieldMessage } from '../../src/ui-kit/FieldMessage';

afterEach(cleanup);

describe('FieldMessage', () => {
  it('R22 an error is announced as an alert with the given id', () => {
    const { container } = render(<FieldMessage id="m1" error="Too short." />);
    const alert = screen.getByRole('alert');
    expect(alert.textContent).toBe('Too short.');
    expect(alert.id).toBe('m1');
    expect(container.querySelector('[data-error]')).not.toBeNull();
  });

  it('R22 a hint is plain text, not an alert', () => {
    render(<FieldMessage id="m1" hint="At least 8 characters." />);
    expect(screen.getByText('At least 8 characters.').id).toBe('m1');
    expect(screen.queryByRole('alert')).toBeNull();
  });

  it('R22 when both are given the error wins and the hint is not shown', () => {
    render(<FieldMessage id="m1" hint="At least 8 characters." error="Too short." />);
    expect(screen.getByRole('alert').textContent).toBe('Too short.');
    expect(screen.queryByText('At least 8 characters.')).toBeNull();
  });

  it('R22 with neither (or empty text) nothing is drawn', () => {
    const { container } = render(<FieldMessage id="m1" hint="" error="" />);
    expect(container.innerHTML).toBe('');
  });

  it('R22 describedBy gives the id only when there is a message to point at', () => {
    expect(describedBy('m1', 'hint')).toBe('m1');
    expect(describedBy('m1', undefined, 'error')).toBe('m1');
    expect(describedBy('m1')).toBeUndefined();
    expect(describedBy('m1', '', '')).toBeUndefined();
  });
});
