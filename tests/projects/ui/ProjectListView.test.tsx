// @vitest-environment jsdom
import { cleanup, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { ProjectSummary } from '../../../src/projects/records/projectRecords';
import { storeFailure } from '../../../src/projects/storeError';
import { ProjectListView, type ListViewStore } from '../../../src/projects/ui/ProjectListView';

beforeEach(() => {
  URL.createObjectURL = vi.fn(() => 'blob:thumb');
  URL.revokeObjectURL = vi.fn();
});
afterEach(cleanup);

const summary = (id: string, name: string, extra: Partial<ProjectSummary> = {}): ProjectSummary => ({ id, name, updatedAt: '2026-10-18T10:00:00.000Z', triangleCount: 1234, ...extra });

function fakeStore(initial: ProjectSummary[]) {
  let projects = [...initial];
  const listProjects = vi.fn(async () => ({ ok: true as const, value: [...projects] }));
  const renameProject = vi.fn(async (id: string, name: string) => {
    projects = projects.map((project) => (project.id === id ? { ...project, name } : project));
    return { ok: true as const, value: undefined };
  });
  const deleteProjects = vi.fn(async (ids: string[], onProgress?: (done: number, total: number) => void) => {
    ids.forEach((id, index) => {
      projects = projects.filter((project) => project.id !== id);
      onProgress?.(index + 1, ids.length);
    });
    return { ok: true as const, value: undefined };
  });
  const loadThumbnail = vi.fn<ListViewStore['loadThumbnail']>(async () => null);
  const store: ListViewStore = { listProjects, renameProject, deleteProjects, loadThumbnail };
  return { store, listProjects, renameProject, deleteProjects, loadThumbnail };
}

async function showList(initial: ProjectSummary[], props: Partial<Parameters<typeof ProjectListView>[0]> = {}) {
  const fake = fakeStore(initial);
  const onOpen = vi.fn();
  render(<ProjectListView store={fake.store} onOpen={onOpen} {...props} />);
  if (initial.length > 0) await screen.findByText(initial[0]!.name);
  return { ...fake, onOpen };
}

const cardOf = (name: string) => screen.getByText(name).closest('[data-testid="project-card"]') as HTMLElement;

describe('ProjectListView', () => {
  it('projects R7 each card shows the name, triangle count and the day of the last change', async () => {
    await showList([summary('a', 'Orc helmet', { triangleCount: 20812 })]);
    const card = cardOf('Orc helmet');
    expect(card.textContent).toContain('20,812 triangles');
    expect(card.textContent).toContain('2026');
  });

  it('projects R7 a stored thumbnail is shown on its card and a project without one gets a plain block', async () => {
    const fake = fakeStore([summary('a', 'With', { thumbnailKey: 't' }), summary('b', 'Without')]);
    fake.loadThumbnail.mockImplementation(async (id: string) => (id === 'a' ? new Blob([new Uint8Array(2)], { type: 'image/jpeg' }) : null));
    render(<ProjectListView store={fake.store} onOpen={vi.fn()} />);
    await screen.findByText('With');
    await waitFor(() => expect(within(cardOf('With')).getByRole('img').getAttribute('src')).toBe('blob:thumb'));
    expect(within(cardOf('Without')).queryByRole('img')).toBeNull();
  });

  it('projects R7 while the list loads it says so, and an empty list says there are no projects yet', async () => {
    const fake = fakeStore([]);
    render(<ProjectListView store={fake.store} onOpen={vi.fn()} />);
    expect(screen.getByText('Loading projects')).toBeTruthy();
    expect(await screen.findByText('No projects yet.')).toBeTruthy();
  });

  it('projects R7 a list that cannot be read shows the store message and Retry reads it again', async () => {
    const fake = fakeStore([summary('a', 'Orc helmet')]);
    fake.listProjects.mockResolvedValueOnce(storeFailure('storage-unavailable', 'Storage is not available.') as never);
    render(<ProjectListView store={fake.store} onOpen={vi.fn()} />);
    expect((await screen.findByRole('alert')).textContent).toContain('Storage is not available.');
    await userEvent.click(screen.getByRole('button', { name: 'Retry' }));
    expect(await screen.findByText('Orc helmet')).toBeTruthy();
    expect(screen.queryByRole('alert')).toBeNull();
  });

  it('projects R8 Open on a card opens that project', async () => {
    const { onOpen } = await showList([summary('a', 'Orc helmet'), summary('b', 'Cube')]);
    await userEvent.click(within(cardOf('Cube')).getByRole('button', { name: 'Open' }));
    expect(onOpen).toHaveBeenCalledWith('b');
  });

  it('projects R8 a notice shows above the list and can be dismissed', async () => {
    const onDismissNotice = vi.fn();
    await showList([], { notice: 'That project no longer exists.', onDismissNotice });
    expect(screen.getByRole('status').textContent).toContain('That project no longer exists.');
    await userEvent.click(screen.getByRole('button', { name: 'Dismiss' }));
    expect(onDismissNotice).toHaveBeenCalled();
  });

  describe('layout', () => {
    const createActions = (large: boolean) => <button type="button">{large ? 'Create (large)' : 'Create'}</button>;
    const headerActions = <button type="button">Settings</button>;

    it('projects R14 the title is "Projects" and the create actions and the header actions sit together in one group', async () => {
      await showList([summary('a', 'Orc helmet')], { createActions, headerActions });
      const group = screen.getByRole('group', { name: 'Project actions' });
      expect(screen.getByRole('heading', { level: 1, name: 'Projects' })).toBeTruthy();
      expect(within(group).getByRole('button', { name: 'Create' })).toBeTruthy();
      expect(within(group).getByRole('button', { name: 'Settings' })).toBeTruthy();
      expect(screen.queryByRole('button', { name: 'Create (large)' })).toBeNull();
    });

    it('projects R14 with no project the page shows a centred empty state with the large create actions, and only Settings stays in the header', async () => {
      await showList([], { createActions, headerActions });
      const empty = await screen.findByTestId('empty-state');
      expect(empty.textContent).toContain('No projects yet.');
      expect(within(empty).getByRole('button', { name: 'Create (large)' })).toBeTruthy();
      expect(screen.queryByRole('button', { name: 'Create' })).toBeNull();
      expect(within(screen.getByRole('group', { name: 'Project actions' })).getByRole('button', { name: 'Settings' })).toBeTruthy();
      expect(screen.queryByRole('checkbox', { name: 'Select all' })).toBeNull();
    });

    it('projects R14 the status slot (the import result) shows under the header', async () => {
      await showList([], { createActions, status: <p>Imported Orc helmet.</p> });
      expect(screen.getByText('Imported Orc helmet.')).toBeTruthy();
    });

    it('projects R14 Select all sits in a toolbar row of its own when there are projects', async () => {
      await showList([summary('a', 'Orc helmet')], { createActions });
      expect(screen.getByRole('toolbar', { name: 'Select projects' }).contains(screen.getByRole('checkbox', { name: 'Select all' }))).toBe(true);
    });

    it('projects R14 the actions on a card are icon buttons with a name and a tooltip and no visible text', async () => {
      await showList([summary('a', 'Orc helmet')]);
      for (const name of ['Open', 'Rename', 'Delete']) {
        const button = within(cardOf('Orc helmet')).getByRole('button', { name });
        expect(button.getAttribute('title')).toBe(name);
        expect(button.textContent).toBe('');
      }
    });
  });

  describe('rename', () => {
    it('projects R8 Enter keeps the new name, trimmed, and the card shows it', async () => {
      const { renameProject } = await showList([summary('a', 'Orc helmet')]);
      await userEvent.click(within(cardOf('Orc helmet')).getByRole('button', { name: 'Rename' }));
      const field = screen.getByRole('textbox', { name: 'Project name' });
      await userEvent.clear(field);
      await userEvent.type(field, '  Goblin  {Enter}');
      await screen.findByText('Goblin');
      expect(renameProject).toHaveBeenCalledWith('a', 'Goblin');
      expect(screen.queryByRole('textbox', { name: 'Project name' })).toBeNull();
    });

    it('projects R8 Save works like Enter', async () => {
      const { renameProject } = await showList([summary('a', 'Orc helmet')]);
      await userEvent.click(within(cardOf('Orc helmet')).getByRole('button', { name: 'Rename' }));
      await userEvent.type(screen.getByRole('textbox', { name: 'Project name' }), ' 2');
      await userEvent.click(screen.getByRole('button', { name: 'Save' }));
      await screen.findByText('Orc helmet 2');
      expect(renameProject).toHaveBeenCalledWith('a', 'Orc helmet 2');
    });

    it('projects R8 Escape and Cancel drop the edit without saving', async () => {
      const { renameProject } = await showList([summary('a', 'Orc helmet')]);
      await userEvent.click(within(cardOf('Orc helmet')).getByRole('button', { name: 'Rename' }));
      await userEvent.type(screen.getByRole('textbox', { name: 'Project name' }), 'xyz{Escape}');
      expect(screen.queryByRole('textbox', { name: 'Project name' })).toBeNull();
      await userEvent.click(within(cardOf('Orc helmet')).getByRole('button', { name: 'Rename' }));
      await userEvent.click(screen.getByRole('button', { name: 'Cancel' }));
      expect(screen.queryByRole('textbox', { name: 'Project name' })).toBeNull();
      expect(renameProject).not.toHaveBeenCalled();
    });

    it('projects R8 an empty or too long name is refused with a message and nothing is saved', async () => {
      const { renameProject } = await showList([summary('a', 'Orc helmet')]);
      await userEvent.click(within(cardOf('Orc helmet')).getByRole('button', { name: 'Rename' }));
      const field = screen.getByRole('textbox', { name: 'Project name' });
      await userEvent.clear(field);
      await userEvent.type(field, '   {Enter}');
      expect(screen.getByText('Enter a name of 1 to 120 characters.')).toBeTruthy();
      await userEvent.clear(field);
      await userEvent.click(field);
      await userEvent.paste('x'.repeat(121));
      await userEvent.keyboard('{Enter}');
      expect(screen.getByText('Enter a name of 1 to 120 characters.')).toBeTruthy();
      expect(renameProject).not.toHaveBeenCalled();
    });

    it('projects R8 pressing Save again while a rename is being written does not write twice', async () => {
      const { renameProject } = await showList([summary('a', 'Orc helmet')]);
      let finish: () => void = () => undefined;
      renameProject.mockImplementationOnce(() => new Promise((resolve) => (finish = () => resolve({ ok: true as const, value: undefined }))));
      await userEvent.click(within(cardOf('Orc helmet')).getByRole('button', { name: 'Rename' }));
      await userEvent.type(screen.getByRole('textbox', { name: 'Project name' }), '2');
      await userEvent.click(screen.getByRole('button', { name: 'Save' }));
      await userEvent.click(screen.getByRole('button', { name: 'Save' }));
      await userEvent.keyboard('{Enter}');
      expect(renameProject).toHaveBeenCalledTimes(1);
      finish();
      await waitFor(() => expect(screen.queryByRole('textbox', { name: 'Project name' })).toBeNull());
    });

    it('projects R8 a rename that finishes after its editor was cancelled does not close another project\'s editor', async () => {
      const { renameProject, listProjects } = await showList([summary('a', 'Orc helmet'), summary('b', 'Cube')]);
      let finish: () => void = () => undefined;
      renameProject.mockImplementationOnce(() => new Promise((resolve) => (finish = () => resolve({ ok: true as const, value: undefined }))));
      await userEvent.click(within(cardOf('Orc helmet')).getByRole('button', { name: 'Rename' }));
      await userEvent.type(screen.getByRole('textbox', { name: 'Project name' }), '2{Enter}');
      await userEvent.click(screen.getByRole('button', { name: 'Cancel' }));
      await userEvent.click(within(cardOf('Cube')).getByRole('button', { name: 'Rename' }));
      await userEvent.type(screen.getByRole('textbox', { name: 'Project name' }), ' keep me');
      const readsBefore = listProjects.mock.calls.length;
      finish();
      await waitFor(() => expect(listProjects.mock.calls.length).toBeGreaterThan(readsBefore));
      expect((screen.getByRole('textbox', { name: 'Project name' }) as HTMLInputElement).value).toBe('Cube keep me');
    });

    it('projects R22 leaving the rename field puts the focus back on that card\'s Rename button', async () => {
      await showList([summary('a', 'Orc helmet')]);
      await userEvent.click(within(cardOf('Orc helmet')).getByRole('button', { name: 'Rename' }));
      await userEvent.keyboard('{Escape}');
      expect(document.activeElement).toBe(within(cardOf('Orc helmet')).getByRole('button', { name: 'Rename' }));
    });

    it('projects R8 a store failure shows its message and keeps the field open', async () => {
      const { renameProject } = await showList([summary('a', 'Orc helmet')]);
      renameProject.mockResolvedValueOnce(storeFailure('storage-unavailable', 'Could not save the name.') as never);
      await userEvent.click(within(cardOf('Orc helmet')).getByRole('button', { name: 'Rename' }));
      await userEvent.type(screen.getByRole('textbox', { name: 'Project name' }), '2{Enter}');
      expect(await screen.findByText('Could not save the name.')).toBeTruthy();
      expect(screen.getByRole('textbox', { name: 'Project name' })).toBeTruthy();
    });
  });

  describe('selecting and deleting', () => {
    it('projects R8 selecting cards shows how many are selected, and Clear unselects them', async () => {
      await showList([summary('a', 'Orc helmet'), summary('b', 'Cube'), summary('c', 'Sphere')]);
      expect(screen.queryByText(/selected/)).toBeNull();
      await userEvent.click(screen.getByRole('checkbox', { name: 'Select Orc helmet' }));
      await userEvent.click(screen.getByRole('checkbox', { name: 'Select Cube' }));
      expect(screen.getByText('2 selected')).toBeTruthy();
      await userEvent.click(screen.getByRole('button', { name: 'Clear' }));
      expect(screen.queryByText(/selected/)).toBeNull();
    });

    it('projects R8 Select all selects every project and unticking it selects none', async () => {
      await showList([summary('a', 'Orc helmet'), summary('b', 'Cube')]);
      await userEvent.click(screen.getByRole('checkbox', { name: 'Select all' }));
      expect(screen.getByText('2 selected')).toBeTruthy();
      await userEvent.click(screen.getByRole('checkbox', { name: 'Select all' }));
      expect(screen.queryByText(/selected/)).toBeNull();
    });

    it('projects R8 Delete on a card asks first with the irreversible wording, and Cancel deletes nothing', async () => {
      const { deleteProjects } = await showList([summary('a', 'Orc helmet')]);
      await userEvent.click(within(cardOf('Orc helmet')).getByRole('button', { name: 'Delete' }));
      const dialog = screen.getByRole('dialog', { name: 'Delete this project?' });
      expect(dialog.textContent).toContain('Orc helmet');
      expect(dialog.textContent).toContain('This cannot be undone');
      expect(document.activeElement).toBe(within(dialog).getByRole('button', { name: 'Cancel' }));
      expect(deleteProjects).not.toHaveBeenCalled();
      await userEvent.click(within(dialog).getByRole('button', { name: 'Cancel' }));
      expect(screen.queryByRole('dialog')).toBeNull();
      expect(deleteProjects).not.toHaveBeenCalled();
    });

    it('projects R8 confirming a single delete removes that project and reloads the list', async () => {
      const { deleteProjects } = await showList([summary('a', 'Orc helmet'), summary('b', 'Cube')]);
      await userEvent.click(within(cardOf('Orc helmet')).getByRole('button', { name: 'Delete' }));
      await userEvent.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Delete' }));
      await waitFor(() => expect(screen.queryByText('Orc helmet')).toBeNull());
      expect(deleteProjects).toHaveBeenCalledWith(['a'], expect.any(Function));
      expect(screen.getByText('Cube')).toBeTruthy();
      expect(screen.queryByRole('dialog')).toBeNull();
    });

    it('projects R8 Delete selected names the count, deletes only after confirming, then clears the selection', async () => {
      const { deleteProjects } = await showList([summary('a', 'Orc helmet'), summary('b', 'Cube'), summary('c', 'Sphere')]);
      await userEvent.click(screen.getByRole('checkbox', { name: 'Select Orc helmet' }));
      await userEvent.click(screen.getByRole('checkbox', { name: 'Select Sphere' }));
      await userEvent.click(screen.getByRole('button', { name: 'Delete selected' }));
      const dialog = screen.getByRole('dialog', { name: 'Delete 2 projects?' });
      expect(dialog.textContent).toContain('This cannot be undone');
      expect(deleteProjects).not.toHaveBeenCalled();
      await userEvent.click(within(dialog).getByRole('button', { name: 'Delete' }));
      await waitFor(() => expect(screen.queryByText('Orc helmet')).toBeNull());
      expect(deleteProjects).toHaveBeenCalledWith(['a', 'c'], expect.any(Function));
      expect(screen.getByText('Cube')).toBeTruthy();
      expect(screen.queryByText(/selected/)).toBeNull();
    });

    it('projects R8 the dialog shows progress while deleting and cannot be dismissed with Escape', async () => {
      const fake = fakeStore([summary('a', 'One'), summary('b', 'Two')]);
      let finish: () => void = () => undefined;
      fake.deleteProjects.mockImplementation(async (_ids, onProgress) => {
        onProgress?.(1, 2);
        await new Promise<void>((resolve) => (finish = resolve));
        return { ok: true as const, value: undefined };
      });
      render(<ProjectListView store={fake.store} onOpen={vi.fn()} />);
      await screen.findByText('One');
      await userEvent.click(screen.getByRole('checkbox', { name: 'Select all' }));
      await userEvent.click(screen.getByRole('button', { name: 'Delete selected' }));
      await userEvent.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Delete' }));
      expect(await screen.findByText('Deleted 1 of 2')).toBeTruthy();
      await userEvent.keyboard('{Escape}');
      expect(screen.getByRole('dialog')).toBeTruthy();
      finish();
      await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
    });

    it('projects R8 a failed delete shows its message above the list and the list is read again', async () => {
      const { deleteProjects, listProjects } = await showList([summary('a', 'Orc helmet')]);
      deleteProjects.mockResolvedValueOnce(storeFailure('storage-unavailable', 'Could not delete the files.') as never);
      const readsBefore = listProjects.mock.calls.length;
      await userEvent.click(within(cardOf('Orc helmet')).getByRole('button', { name: 'Delete' }));
      await userEvent.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Delete' }));
      expect((await screen.findByRole('alert')).textContent).toContain('Could not delete the files.');
      expect(listProjects.mock.calls.length).toBeGreaterThan(readsBefore);
      expect(screen.getByText('Orc helmet')).toBeTruthy();
    });
  });
});
