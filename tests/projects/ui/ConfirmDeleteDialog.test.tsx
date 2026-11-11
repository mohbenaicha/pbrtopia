// @vitest-environment jsdom
import { cleanup, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { ProjectSummary } from '../../../src/projects/records/projectRecords';
import { ConfirmDeleteDialog } from '../../../src/projects/ui/ConfirmDeleteDialog';

afterEach(cleanup);

const summary = (id: string, name: string): ProjectSummary => ({ id, name, updatedAt: '2026-10-18T10:00:00.000Z', triangleCount: 10 });
const props = (patch: Partial<Parameters<typeof ConfirmDeleteDialog>[0]> = {}) => ({ projects: [summary('a', 'Orc helmet')], progress: null, confirm: vi.fn(), cancel: vi.fn(), ...patch });

describe('ConfirmDeleteDialog', () => {
  it('projects R8 with nothing to delete it is closed', () => {
    render(<ConfirmDeleteDialog {...props({ projects: [] })} />);
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('projects R8 one project is named in quotes together with what is lost and that it cannot be undone', () => {
    render(<ConfirmDeleteDialog {...props()} />);
    const dialog = screen.getByRole('dialog', { name: 'Delete this project?' });
    expect(within(dialog).getByText(/^"Orc helmet": The model, textures, projection sets and thumbnail are removed from this browser\. This cannot be undone\.$/)).toBeTruthy();
  });

  it('shared/materialgen-prep R57 the effect text can be replaced by the app', () => {
    render(<ConfirmDeleteDialog {...props({ deleteEffect: 'The maps and thumbnail are removed.' })} />);
    const dialog = screen.getByRole('dialog', { name: 'Delete this project?' });
    expect(within(dialog).getByText('"Orc helmet": The maps and thumbnail are removed.')).toBeTruthy();
  });

  it('projects R8 several projects are asked about by count', () => {
    render(<ConfirmDeleteDialog {...props({ projects: [summary('a', 'A'), summary('b', 'B'), summary('c', 'C')] })} />);
    const dialog = screen.getByRole('dialog', { name: 'Delete 3 projects?' });
    expect(within(dialog).getByText(/^3 projects: /)).toBeTruthy();
  });

  it('projects R8 Delete confirms, Cancel and Escape decline', async () => {
    const dialogProps = props();
    render(<ConfirmDeleteDialog {...dialogProps} />);
    await userEvent.click(screen.getByRole('button', { name: 'Delete' }));
    expect(dialogProps.confirm).toHaveBeenCalledOnce();
    await userEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    await userEvent.keyboard('{Escape}');
    expect(dialogProps.cancel).toHaveBeenCalledTimes(2);
    expect(dialogProps.confirm).toHaveBeenCalledOnce();
  });

  it('projects R8 while deleting it reports the progress, cannot be cancelled and ignores Escape', async () => {
    const dialogProps = props({ projects: [summary('a', 'A'), summary('b', 'B')], progress: { done: 1, total: 2 } });
    render(<ConfirmDeleteDialog {...dialogProps} />);
    expect(screen.getByRole('status').textContent).toBe('Deleted 1 of 2');
    expect((screen.getByRole('button', { name: 'Cancel' }) as HTMLButtonElement).disabled).toBe(true);
    await userEvent.keyboard('{Escape}');
    expect(dialogProps.cancel).not.toHaveBeenCalled();
  });

  it('projects R8 no progress line is shown before deleting starts', () => {
    render(<ConfirmDeleteDialog {...props()} />);
    expect(screen.queryByRole('status')).toBeNull();
  });
});
