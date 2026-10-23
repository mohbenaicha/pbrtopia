// @vitest-environment jsdom
import { cleanup, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { ProjectSummary } from '../../../src/projects/records/projectRecords';
import { ProjectCard } from '../../../src/projects/ui/ProjectCard';

beforeEach(() => {
  URL.createObjectURL = vi.fn(() => 'blob:thumb');
  URL.revokeObjectURL = vi.fn();
});
afterEach(cleanup);

const summary: ProjectSummary = { id: 'a', name: 'Orc helmet', updatedAt: '2026-10-18T10:00:00.000Z', triangleCount: 20812 };

function show(patch: Partial<Parameters<typeof ProjectCard>[0]> = {}) {
  const handlers = { open: vi.fn(), toggleSelected: vi.fn(), startRename: vi.fn(), saveName: vi.fn(async () => null), cancelRename: vi.fn(), remove: vi.fn() };
  const loadThumbnail = vi.fn(async () => null as Blob | null);
  const props = { summary, selected: false, renaming: false, loadThumbnail, ...handlers, ...patch };
  const view = render(
    <ul>
      <ProjectCard {...props} />
    </ul>,
  );
  const again = (next: Partial<typeof props>): void => view.rerender(<ul><ProjectCard {...props} {...next} /></ul>);
  return { ...handlers, loadThumbnail, again };
}

describe('ProjectCard', () => {
  it('projects R7 the card names the project and gives its triangle count and the day of the last change', () => {
    show();
    expect(screen.getByRole('heading', { name: 'Orc helmet' })).toBeTruthy();
    expect(screen.getByText(/^20,812 triangles · Oct 18, 2026$/)).toBeTruthy();
  });

  it('projects R7 the stored thumbnail is shown, loaded for this project', async () => {
    const loadThumbnail = vi.fn(async () => new Blob(['jpg']));
    show({ loadThumbnail });
    expect((await screen.findByRole('img', { name: 'Orc helmet thumbnail' })).getAttribute('src')).toBe('blob:thumb');
    expect(loadThumbnail).toHaveBeenCalledWith('a');
  });

  it('projects R7 without a thumbnail the card has no picture', async () => {
    const { loadThumbnail } = show();
    await waitFor(() => expect(loadThumbnail).toHaveBeenCalledWith('a'));
    expect(screen.queryByRole('img')).toBeNull();
  });

  it('projects R8 Open, Rename and Delete each report their own press', async () => {
    const { open, startRename, remove } = show();
    await userEvent.click(screen.getByRole('button', { name: 'Open' }));
    expect([open, startRename, remove].map((fn) => fn.mock.calls.length)).toEqual([1, 0, 0]);
    await userEvent.click(screen.getByRole('button', { name: 'Rename' }));
    expect([open, startRename, remove].map((fn) => fn.mock.calls.length)).toEqual([1, 1, 0]);
    await userEvent.click(screen.getByRole('button', { name: 'Delete' }));
    expect([open, startRename, remove].map((fn) => fn.mock.calls.length)).toEqual([1, 1, 1]);
  });

  it('projects R8 the selection box is named after the project, shows the state, and reports the new one', async () => {
    const { toggleSelected, again } = show();
    const box = screen.getByRole('checkbox', { name: 'Select Orc helmet' }) as HTMLInputElement;
    expect(box.checked).toBe(false);
    await userEvent.click(box);
    expect(toggleSelected).toHaveBeenCalledWith(true);
    again({ selected: true });
    expect((screen.getByRole('checkbox', { name: 'Select Orc helmet' }) as HTMLInputElement).checked).toBe(true);
    expect(screen.getByTestId('project-card').hasAttribute('data-selected')).toBe(true);
  });

  it('projects R8 while renaming the name field replaces the name and the actions', () => {
    show({ renaming: true });
    expect((screen.getByRole('textbox', { name: 'Project name' }) as HTMLInputElement).value).toBe('Orc helmet');
    expect(screen.queryByRole('button', { name: 'Open' })).toBeNull();
    expect(screen.queryByRole('heading')).toBeNull();
  });

  it('viewport-layout R22 when renaming ends the keyboard focus goes to this card\'s Rename button', () => {
    const { again } = show({ renaming: true });
    again({ renaming: false });
    expect(document.activeElement).toBe(screen.getByRole('button', { name: 'Rename' }));
  });
});
