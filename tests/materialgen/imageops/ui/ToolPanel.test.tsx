// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { ToolPanel } from '@mat/imageops/ui/ToolPanel';

afterEach(cleanup);

function show(patch: Partial<React.ComponentProps<typeof ToolPanel>> = {}) {
  const handlers = { onReset: vi.fn(), onCancel: vi.fn(), onApply: vi.fn() };
  render(
    <ToolPanel title="Crop" canApply applying={false} error={null} {...handlers} {...patch}>
      <p>settings</p>
    </ToolPanel>,
  );
  return handlers;
}

describe('ToolPanel (imageops R52)', () => {
  it('R52 is a labelled region with the settings and the Reset, Cancel and Apply footer, and it is not a dialog', () => {
    show();
    expect(screen.getByRole('region', { name: 'Crop' })).toBeTruthy();
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(screen.getByText('settings')).toBeTruthy();
    for (const name of ['Reset', 'Cancel', 'Apply']) expect(screen.getByRole('button', { name })).toBeTruthy();
  });

  it('R52 Escape cancels, but not while an Apply is running', () => {
    const { onCancel } = show();
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(onCancel).toHaveBeenCalledTimes(1);
    cleanup();
    const running = show({ applying: true });
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(running.onCancel).not.toHaveBeenCalled();
  });

  it('R52 the Escape listener goes away with the panel', () => {
    const { onCancel } = show();
    cleanup();
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(onCancel).not.toHaveBeenCalled();
  });

  it('R12 shows the error line, and Apply follows canApply', () => {
    show({ error: 'Nothing changed.', canApply: false });
    expect(screen.getByRole('alert').textContent).toBe('Nothing changed.');
    expect((screen.getByRole('button', { name: 'Apply' }) as HTMLButtonElement).disabled).toBe(true);
  });
});
