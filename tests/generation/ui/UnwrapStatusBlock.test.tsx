// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { UnwrapState } from '../../../src/generation/generateStore';
import { UnwrapStatusBlock } from '../../../src/generation/ui/UnwrapStatusBlock';

afterEach(cleanup);

function setup(unwrap: UnwrapState) {
  const onDismissError = vi.fn();
  const view = render(<UnwrapStatusBlock unwrap={unwrap} onDismissError={onDismissError} />);
  return { onDismissError, view };
}

describe('UnwrapStatusBlock (R17)', () => {
  it('R17 a running unwrap shows a progress bar with the percent done, rounded', () => {
    setup({ status: 'running', fraction: 0.456, error: null });
    const bar = screen.getByRole('progressbar', { name: 'Generating UVs' });
    expect(bar.getAttribute('aria-valuenow')).toBe('46');
    expect(bar.querySelector('[data-indeterminate]')).toBeNull();
  });

  it('R17 a bar that has not moved yet is shown as indeterminate, with no percent', () => {
    setup({ status: 'running', fraction: 0, error: null });
    const bar = screen.getByRole('progressbar', { name: 'Generating UVs' });
    expect(bar.hasAttribute('aria-valuenow')).toBe(false);
    expect(bar.querySelector('[data-indeterminate]')).not.toBeNull();
  });

  it('R17 a failed unwrap shows its message in a dialog, and OK or Escape dismisses it', () => {
    const { onDismissError } = setup({ status: 'failed', fraction: 0.5, error: { category: 'engine', retryable: false, message: 'The model has no faces.' } });
    expect(screen.getByRole('dialog', { name: 'Could not generate UVs' }).textContent).toContain('The model has no faces.');
    expect(screen.queryByRole('progressbar')).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'OK' }));
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(onDismissError).toHaveBeenCalledTimes(2);
  });

  it('R17 an idle or finished unwrap, or a failure with no error, shows nothing', () => {
    for (const unwrap of [
      { status: 'idle', fraction: 0, error: null },
      { status: 'done', fraction: 1, error: null },
      { status: 'failed', fraction: 0, error: null },
    ] as UnwrapState[]) {
      const { view } = setup(unwrap);
      expect(view.container.innerHTML).toBe('');
      view.unmount();
    }
  });
});
