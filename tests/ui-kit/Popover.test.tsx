// @vitest-environment jsdom
import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { Popover, Spinner } from '../../src/ui-kit';

afterEach(cleanup);

describe('Popover', () => {
  it('R22 it shows its panel only while open, next to the trigger', () => {
    const { rerender } = render(<Popover open={false} onClose={() => undefined} label="Viewport settings" trigger={<button type="button">gear</button>}>panel</Popover>);
    expect(screen.queryByRole('dialog')).toBeNull();
    rerender(<Popover open onClose={() => undefined} label="Viewport settings" trigger={<button type="button">gear</button>}>panel</Popover>);
    expect(screen.getByRole('dialog', { name: 'Viewport settings' }).textContent).toBe('panel');
  });

  it('R22 Escape and a click outside both ask to close; a click inside does not', async () => {
    const onClose = vi.fn();
    const user = userEvent.setup();
    render(
      <>
        <button type="button">elsewhere</button>
        <Popover open onClose={onClose} label="Viewport settings" trigger={<button type="button">gear</button>}>
          <button type="button">inside</button>
        </Popover>
      </>,
    );
    await user.click(screen.getByRole('button', { name: 'inside' }));
    expect(onClose).not.toHaveBeenCalled();
    await user.keyboard('{Escape}');
    expect(onClose).toHaveBeenCalledTimes(1);
    await user.click(screen.getByRole('button', { name: 'elsewhere' }));
    expect(onClose).toHaveBeenCalledTimes(2);
  });
});

describe('Spinner', () => {
  it('R22 it is announced as a status with its label', () => {
    render(<Spinner label="Generating" />);
    expect(screen.getByRole('status', { name: 'Generating' })).toBeTruthy();
  });
});
