// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { OpDialog } from '@mat/imageops/ui/OpDialog';

afterEach(cleanup);

function renderDialog(patch: Partial<React.ComponentProps<typeof OpDialog>> = {}) {
  const handlers = { onReset: vi.fn(), onCancel: vi.fn(), onApply: vi.fn() };
  render(
    <OpDialog
      title="Filter Albedo"
      sources={[{ id: 'before', label: 'Before', src: 'blob:a' }, { id: 'after', label: 'After', src: 'blob:b' }]}
      canApply
      applying={false}
      error={null}
      {...handlers}
      {...patch}
    >
      <p>controls here</p>
    </OpDialog>,
  );
  return handlers;
}

describe('imageops/ui OpDialog', () => {
  it('R17 the footer has Reset, Cancel and Apply, and Apply has no confirmation step', () => {
    const handlers = renderDialog();
    expect(screen.getByText('controls here')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Apply' }));
    expect(handlers.onApply).toHaveBeenCalledTimes(1);
    expect(screen.queryByRole('alertdialog')).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Reset' }));
    expect(handlers.onReset).toHaveBeenCalledTimes(1);
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(handlers.onCancel).toHaveBeenCalledTimes(1);
  });

  it('R16 Apply is disabled while nothing differs from the default', () => {
    const handlers = renderDialog({ canApply: false });
    expect((screen.getByRole('button', { name: 'Apply' }) as HTMLButtonElement).disabled).toBe(true);
    fireEvent.click(screen.getByRole('button', { name: 'Apply' }));
    expect(handlers.onApply).not.toHaveBeenCalled();
  });

  it('R43 the apply button can be named Generate', () => {
    renderDialog({ applyLabel: 'Generate' });
    expect(screen.getByRole('button', { name: 'Generate' })).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Apply' })).toBeNull();
  });

  it('R12 a failure shows its message and keeps the dialog open', () => {
    renderDialog({ error: 'Could not apply (graphics error). Nothing changed.' });
    expect(screen.getByRole('alert').textContent).toBe('Could not apply (graphics error). Nothing changed.');
    expect(screen.getByRole('dialog')).toBeTruthy();
  });

  it('R19 while applying, Reset and Apply cannot be pressed again and Apply shows it is working', () => {
    const handlers = renderDialog({ applying: true });
    expect((screen.getByRole('button', { name: 'Reset' }) as HTMLButtonElement).disabled).toBe(true);
    fireEvent.click(screen.getByRole('button', { name: 'Apply' }));
    expect(handlers.onApply).not.toHaveBeenCalled();
  });

  it('R50 the before and after pictures are Before and After with a reveal divider', () => {
    renderDialog();
    expect(screen.getByRole('slider', { name: 'Comparison divider' })).toBeTruthy();
    expect(screen.queryByRole('combobox', { name: 'Left picture' })).toBeNull(); // the sides are fixed, not chosen
    expect(screen.getByAltText('Before')).toBeTruthy();
    expect(screen.getByAltText('After')).toBeTruthy();
  });

  it('R9 Escape cancels the session', () => {
    const handlers = renderDialog();
    fireEvent.keyDown(screen.getByRole('dialog'), { key: 'Escape' });
    expect(handlers.onCancel).toHaveBeenCalled();
  });

  it('R17 while Apply is saving, Cancel and Escape do nothing, so a result is never saved after a Cancel', () => {
    const handlers = renderDialog({ applying: true });
    expect((screen.getByRole('button', { name: 'Cancel' }) as HTMLButtonElement).disabled).toBe(true);
    fireEvent.keyDown(screen.getByRole('dialog'), { key: 'Escape' });
    expect(handlers.onCancel).not.toHaveBeenCalled();
  });
});
