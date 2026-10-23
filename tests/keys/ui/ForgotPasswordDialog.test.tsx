// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { ForgotPasswordDialog } from '../../../src/keys/ui/ForgotPasswordDialog';

afterEach(cleanup);

function setup(props: Partial<React.ComponentProps<typeof ForgotPasswordDialog>> = {}) {
  const onCancel = vi.fn();
  const onConfirm = vi.fn();
  render(<ForgotPasswordDialog open busy={false} error={null} onCancel={onCancel} onConfirm={onConfirm} {...props} />);
  return { onCancel, onConfirm };
}

describe('ForgotPasswordDialog (R6)', () => {
  it('R6 nothing is shown while closed', () => {
    setup({ open: false });
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('R6 it says the password cannot be recovered, and Cancel has focus so a stray Enter deletes nothing', () => {
    const { onConfirm } = setup();
    expect(screen.getByRole('dialog', { name: 'Forget your password?' }).textContent).toContain('The password cannot be recovered.');
    expect(document.activeElement).toBe(screen.getByRole('button', { name: 'Cancel' }));
    expect(onConfirm).not.toHaveBeenCalled();
  });

  it('R6 Cancel and Delete saved keys each call their own callback once; Escape cancels', () => {
    const { onCancel, onConfirm } = setup();
    fireEvent.click(screen.getByRole('button', { name: 'Delete saved keys' }));
    expect(onConfirm).toHaveBeenCalledTimes(1);
    expect(onCancel).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(onCancel).toHaveBeenCalledTimes(2);
  });

  it('R6 while deleting, Cancel is disabled and Escape does not close the dialog', () => {
    const { onCancel } = setup({ busy: true });
    expect((screen.getByRole('button', { name: 'Cancel' }) as HTMLButtonElement).disabled).toBe(true);
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(onCancel).not.toHaveBeenCalled();
  });

  it('R6 a failed delete shows its message as an alert in the dialog', () => {
    setup({ error: 'Could not delete the keys.' });
    expect(screen.getByRole('alert').textContent).toBe('Could not delete the keys.');
  });

  it('R6 a title and text can be given, as the reset of an unreadable vault does', () => {
    setup({ title: 'Reset saved keys?', text: 'Unreadable.' });
    expect(screen.getByRole('dialog', { name: 'Reset saved keys?' }).textContent).toContain('Unreadable.');
    expect(screen.queryByText(/cannot be recovered/)).toBeNull();
  });
});
