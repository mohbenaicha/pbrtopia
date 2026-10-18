// @vitest-environment jsdom
import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { Button, Dialog } from '../../src/ui-kit';

afterEach(cleanup);

const actions = (
  <>
    <Button>Cancel</Button>
    <Button variant="primary">Unlock</Button>
  </>
);

describe('Dialog', () => {
  it('R22 a closed dialog renders nothing', () => {
    render(<Dialog open={false} title="Password" onClose={() => undefined}>body</Dialog>);
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('R22 an open dialog is a modal named by its title and shows its content and actions', () => {
    render(<Dialog open title="Password" onClose={() => undefined} actions={actions}>Enter it</Dialog>);
    const dialog = screen.getByRole('dialog', { name: 'Password' });
    expect(dialog.getAttribute('aria-modal')).toBe('true');
    expect(screen.getByText('Enter it')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Unlock' })).toBeTruthy();
  });

  it('R22 focus moves into the dialog on open, stays inside on Tab, and returns to the opener on close', async () => {
    const user = userEvent.setup();
    function Host({ open }: { open: boolean }): React.JSX.Element {
      return (
        <>
          <button type="button">opener</button>
          <Dialog open={open} title="Password" onClose={() => undefined} actions={actions}>text</Dialog>
        </>
      );
    }
    const opener = (): HTMLElement => screen.getByRole('button', { name: 'opener' });
    const { rerender } = render(<Host open={false} />);
    opener().focus();
    rerender(<Host open />);
    expect(screen.getByRole('dialog').contains(document.activeElement)).toBe(true);
    for (let i = 0; i < 5; i++) {
      await user.tab();
      expect(screen.getByRole('dialog').contains(document.activeElement)).toBe(true);
    }
    rerender(<Host open={false} />);
    expect(document.activeElement).toBe(opener());
  });

  it('R22 Escape closes a dismissible dialog and does nothing on a dialog that is not', async () => {
    const onClose = vi.fn();
    const user = userEvent.setup();
    const { rerender } = render(<Dialog open title="Password" onClose={onClose}>text</Dialog>);
    await user.keyboard('{Escape}');
    expect(onClose).toHaveBeenCalledTimes(1);
    rerender(<Dialog open title="Password" onClose={onClose} dismissible={false}>text</Dialog>);
    await user.keyboard('{Escape}');
    expect(onClose).toHaveBeenCalledTimes(1);
  });
});
