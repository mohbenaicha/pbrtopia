// @vitest-environment jsdom
import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { SelectionBar } from '../../../src/projects/ui/SelectionBar';

afterEach(cleanup);

describe('SelectionBar', () => {
  it('projects R8 it says how many projects are selected', () => {
    const { rerender } = render(<SelectionBar count={1} deleteSelected={vi.fn()} clear={vi.fn()} />);
    expect(screen.getByText('1 selected')).toBeTruthy();
    rerender(<SelectionBar count={12} deleteSelected={vi.fn()} clear={vi.fn()} />);
    expect(screen.getByText('12 selected')).toBeTruthy();
  });

  it('projects R8 Delete selected and Clear each report their own press and nothing else', async () => {
    const deleteSelected = vi.fn();
    const clear = vi.fn();
    render(<SelectionBar count={2} deleteSelected={deleteSelected} clear={clear} />);
    await userEvent.click(screen.getByRole('button', { name: 'Delete selected' }));
    expect(deleteSelected).toHaveBeenCalledOnce();
    expect(clear).not.toHaveBeenCalled();
    await userEvent.click(screen.getByRole('button', { name: 'Clear' }));
    expect(clear).toHaveBeenCalledOnce();
    expect(deleteSelected).toHaveBeenCalledOnce();
  });
});
