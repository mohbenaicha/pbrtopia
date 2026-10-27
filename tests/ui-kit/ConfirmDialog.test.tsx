// @vitest-environment jsdom
import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { ConfirmDialog } from '../../src/ui-kit';

afterEach(cleanup);

function renderDialog(props: Partial<React.ComponentProps<typeof ConfirmDialog>> = {}) {
  const onConfirm = vi.fn();
  const onCancel = vi.fn();
  render(
    <ConfirmDialog open title="Delete this projection set?" confirmLabel="Delete" busy={false} onConfirm={onConfirm} onCancel={onCancel} {...props}>
      It cannot be undone.
    </ConfirmDialog>,
  );
  return { onConfirm, onCancel };
}

describe('ConfirmDialog (mode R35, settings R13)', () => {
  it('R35 R13 a closed dialog renders nothing', () => {
    renderDialog({ open: false });
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('R35 R13 shows the title and text, Cancel comes first and has the focus, and the danger button carries the label', () => {
    renderDialog();
    expect(screen.getByRole('dialog', { name: 'Delete this projection set?' })).toBeTruthy();
    expect(screen.getByText('It cannot be undone.')).toBeTruthy();
    const buttons = screen.getAllByRole('button');
    expect(buttons.map((button) => button.textContent)).toEqual(['Cancel', 'Delete']);
    expect(document.activeElement).toBe(buttons[0]);
  });

  it('R35 R13 Cancel and Escape ask to cancel, Delete asks to confirm once', async () => {
    const user = userEvent.setup();
    const { onConfirm, onCancel } = renderDialog();
    await user.keyboard('{Escape}');
    expect(onCancel).toHaveBeenCalledTimes(1);
    await user.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(onCancel).toHaveBeenCalledTimes(2);
    expect(onConfirm).not.toHaveBeenCalled();
    await user.click(screen.getByRole('button', { name: 'Delete' }));
    expect(onConfirm).toHaveBeenCalledTimes(1);
  });

  it('R35 R13 while busy the confirm button is busy, Cancel is off, Escape does nothing and the status text shows', async () => {
    const user = userEvent.setup();
    const { onConfirm, onCancel } = renderDialog({ busy: true, status: 'Deleted 2 of 5' });
    expect((screen.getByRole('button', { name: 'Cancel' }) as HTMLButtonElement).disabled).toBe(true);
    expect(screen.getByRole('button', { name: 'Delete' }).getAttribute('aria-busy')).toBe('true');
    await user.keyboard('{Escape}');
    await user.click(screen.getByRole('button', { name: 'Delete' }));
    expect(onCancel).not.toHaveBeenCalled();
    expect(onConfirm).not.toHaveBeenCalled();
    expect(screen.getByRole('status').textContent).toBe('Deleted 2 of 5');
  });
});
