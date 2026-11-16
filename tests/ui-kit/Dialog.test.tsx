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
  it('R38 an open dialog is drawn through a portal into the body, outside the tree that renders it', () => {
    const { container } = render(<div className="panel"><Dialog open title="Password" onClose={() => undefined}>body</Dialog></div>);
    const backdrop = screen.getByRole('dialog').parentElement as HTMLElement;
    expect(container.contains(backdrop)).toBe(false);
    expect(backdrop.parentElement).toBe(document.body);
  });

  it('tutorial R14 a wide dialog is marked wide, a default one carries no size mark', () => {
    const { rerender } = render(<Dialog open title="Wide" size="wide" onClose={() => undefined}>body</Dialog>);
    expect(screen.getByRole('dialog').getAttribute('data-size')).toBe('wide');
    rerender(<Dialog open title="Plain" onClose={() => undefined}>body</Dialog>);
    expect(screen.getByRole('dialog').getAttribute('data-size')).toBeNull();
  });

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

  it('R22 a click outside closes a dismissible dialog, unless closeOnOutsideClick is false; Escape still closes it then', async () => {
    const onClose = vi.fn();
    const user = userEvent.setup();
    const { rerender } = render(<Dialog open title="Password" onClose={onClose}>text</Dialog>);
    await user.pointer({ keys: '[MouseLeft]', target: document.body });
    expect(onClose).toHaveBeenCalledTimes(1);
    rerender(<Dialog open title="Password" onClose={onClose} closeOnOutsideClick={false}>text</Dialog>);
    await user.pointer({ keys: '[MouseLeft]', target: document.body });
    expect(onClose).toHaveBeenCalledTimes(1);
    await user.keyboard('{Escape}');
    expect(onClose).toHaveBeenCalledTimes(2);
  });

  it('R44 a stacked dialog is marked for the higher layer, and a press inside it never dismisses the dialog behind it; Escape reaches only it', async () => {
    const outer = vi.fn();
    const inner = vi.fn();
    const user = userEvent.setup();
    render(
      <>
        <Dialog open title="Export" onClose={outer}>behind</Dialog>
        <Dialog open stacked title="Emissive" onClose={inner} closeOnOutsideClick={false}>in front</Dialog>
      </>,
    );
    expect((screen.getByRole('dialog', { name: 'Emissive' }).parentElement as HTMLElement).hasAttribute('data-stacked')).toBe(true);
    expect((screen.getByRole('dialog', { name: 'Export' }).parentElement as HTMLElement).hasAttribute('data-stacked')).toBe(false);
    await user.pointer({ keys: '[MouseLeft]', target: screen.getByText('in front') });
    expect(outer).not.toHaveBeenCalled();
    await user.keyboard('{Escape}');
    expect(inner).toHaveBeenCalledTimes(1);
    expect(outer).not.toHaveBeenCalled();
  });
});
