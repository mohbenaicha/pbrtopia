// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { StorageSection } from '../../../src/shell/settings/StorageSection';
import type { ProjectSummary } from '../../../src/projects/records/projectRecords';
import type { StorageEstimate } from '../../../src/projects/storage/storageHealth';
import { storeFailure, type StoreResult } from '../../../src/projects/storeError';
import type { ProjectImportState } from '../../../src/projects/ui/ImportProjectButton';

afterEach(cleanup);

const MIB = 1024 * 1024;
const GIB = 1024 * MIB;
const DELETE_ALL_TEXT = 'Every project and its files is removed from this browser. Settings and the saved API keys stay. This cannot be undone.';

const idleImport = (overrides: Partial<ProjectImportState> = {}): ProjectImportState => ({ importing: false, progress: null, message: null, error: null, start: vi.fn(async () => undefined), ...overrides });

const ok = { ok: true as const, value: undefined };
const summary = (id: string): ProjectSummary => ({ id, name: id, updatedAt: '2026-10-26T10:00:00.000Z', triangleCount: 1 });
type DeleteProjects = (ids: string[], onProgress?: (done: number, total: number) => void) => Promise<StoreResult<void>>;

function show(
  options: {
    estimate?: StorageEstimate | null;
    persist?: () => Promise<boolean>;
    projectImport?: ProjectImportState;
    projects?: string[]; // the stored project ids, newest first
    listProjects?: () => Promise<StoreResult<ProjectSummary[]>>;
    deleteProjects?: DeleteProjects;
  } = {},
) {
  const remaining = [...(options.projects ?? [])];
  const store = {
    estimateStorage: vi.fn(async () => (options.estimate === undefined ? { usedBytes: 412 * MIB, quotaBytes: 8 * GIB } : options.estimate)),
    requestPersistence: vi.fn(options.persist ?? (async () => true)),
    listProjects: vi.fn(options.listProjects ?? (async () => ({ ok: true as const, value: remaining.map(summary) }))),
    deleteProjects: vi.fn<DeleteProjects>(
      options.deleteProjects ??
        (async (ids, onProgress) => {
          ids.forEach((id, index) => {
            remaining.splice(remaining.indexOf(id), 1);
            onProgress?.(index + 1, ids.length);
          });
          return ok;
        }),
    ),
    saveAppSettings: vi.fn(async () => ok),
  };
  render(<StorageSection store={store} projectImport={options.projectImport ?? idleImport()} deleteAllText={DELETE_ALL_TEXT} />);
  return store;
}

describe('StorageSection', () => {
  it('settings R12 it is a titled page of three cards, and each card keeps its button in its own last row', async () => {
    show();
    await waitFor(() => expect(screen.getByText('412 MB of 8 GB used')).toBeTruthy());
    const page = screen.getByRole('region', { name: 'Storage' });
    expect(within(page).getByRole('heading', { level: 2, name: 'Storage' })).toBeTruthy();
    expect(within(page).getAllByRole('heading', { level: 3 }).map((heading) => heading.textContent)).toEqual(['Usage', 'Keep my data', 'Import project']);
    expect(within(within(page).getByRole('group', { name: 'Keep my data' })).getByRole('button', { name: 'Keep my data' }).closest('[data-actions]')).not.toBeNull();
    expect(within(within(page).getByRole('group', { name: 'Import project' })).getByRole('button', { name: 'Import project' }).closest('[data-actions]')).not.toBeNull();
  });

  it('settings R12 the answer to Keep my data shows in its own card, under the rows and above the button', async () => {
    show();
    await userEvent.click(screen.getByRole('button', { name: 'Keep my data' }));
    const group = screen.getByRole('group', { name: 'Keep my data' });
    const answer = await within(group).findByText("Your browser will keep this site's data.");
    expect(answer.closest('[data-messages]')).not.toBeNull();
  });

  it('settings R10 shows the usage in the units of the storage warning', async () => {
    show();
    await waitFor(() => expect(screen.getByText('412 MB of 8 GB used')).toBeTruthy());
  });

  it('settings R10 says usage is unknown when the browser gives no estimate', async () => {
    const store = show({ estimate: null });
    await waitFor(() => expect(store.estimateStorage).toHaveBeenCalled());
    expect(await screen.findByText('Usage unknown')).toBeTruthy();
  });

  it('settings R10 shows the low-space warning text when space is low, and not otherwise', async () => {
    show({ estimate: { usedBytes: GIB - 120 * MIB, quotaBytes: GIB } });
    expect(await screen.findByText(/Browser storage is almost full: 120 MB free of 1 GB\./)).toBeTruthy();
    cleanup();
    show();
    await screen.findByText('412 MB of 8 GB used');
    expect(screen.queryByText(/almost full/)).toBeNull();
  });

  it('settings R10 Keep my data asks the browser and reports agreed in words, busy while it asks', async () => {
    let answer: (agreed: boolean) => void = () => undefined;
    const store = show({ persist: () => new Promise<boolean>((resolve) => void (answer = resolve)) });
    fireEvent.click(screen.getByRole('button', { name: 'Keep my data' }));
    expect(screen.getByRole('button', { name: /Keep my data/ }).getAttribute('aria-busy')).toBe('true');
    expect(store.requestPersistence).toHaveBeenCalledOnce();
    answer(true);
    expect(await screen.findByText("Your browser will keep this site's data.")).toBeTruthy();
  });

  it('settings R10 a browser that does not agree, or cannot, gets the export advice', async () => {
    show({ persist: async () => false });
    fireEvent.click(screen.getByRole('button', { name: 'Keep my data' }));
    expect(await screen.findByText(/did not agree \(or does not support it\)\. Export your projects to keep copies\./)).toBeTruthy();
  });

  it('settings R10 the note explains eviction and where Export is', () => {
    show();
    expect(screen.getByText(/may delete site data when space runs low/)).toBeTruthy();
    expect(screen.getByText(/Export project/)).toBeTruthy();
  });

  it('settings R11 has the shared Import project control, and after an import says what was imported and where it is', () => {
    show({ projectImport: idleImport({ message: 'Imported Helmet.' }) });
    expect(screen.getByRole('button', { name: 'Import project' })).toBeTruthy();
    expect(screen.getByText('Imported Helmet.')).toBeTruthy();
    expect(screen.getByText(/in the project list/)).toBeTruthy();
  });

  it('settings R11 an import started elsewhere shows as busy here', () => {
    show({ projectImport: idleImport({ importing: true, progress: 0.5 }) });
    expect(screen.getByRole('button', { name: /Import project/ }).getAttribute('aria-busy')).toBe('true');
  });
});

describe('StorageSection delete all data (settings R13)', () => {
  const deleteAll = (): HTMLElement => screen.getByRole('button', { name: /Delete all data/ });
  const usageGroup = (): HTMLElement => screen.getByRole('group', { name: 'Usage' });

  it('R13 the Delete all data button sits in the Storage used row beside the usage text', async () => {
    show();
    await screen.findByText('412 MB of 8 GB used');
    const row = screen.getByText('412 MB of 8 GB used').parentElement!;
    expect(within(row).getByRole('button', { name: 'Delete all data' })).toBeTruthy();
    expect(usageGroup().contains(row)).toBe(true);
  });

  it('R13 with no project it says so and opens no dialog', async () => {
    const store = show({ projects: [] });
    await userEvent.click(deleteAll());
    expect(await within(usageGroup()).findByText('There are no projects to delete.')).toBeTruthy();
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(store.deleteProjects).not.toHaveBeenCalled();
  });

  it('R13 the dialog is titled with the count, says Settings and the API keys stay, and has Cancel first and focused', async () => {
    show({ projects: ['a', 'b'] });
    await userEvent.click(deleteAll());
    const dialog = await screen.findByRole('dialog', { name: 'Delete all 2 projects?' });
    expect(dialog.textContent).toContain(DELETE_ALL_TEXT);
    expect(dialog.textContent).toMatch(/Settings and the saved API keys stay/);
    expect(dialog.textContent).toMatch(/cannot be undone/);
    const buttons = within(dialog).getAllByRole('button');
    expect(buttons.map((button) => button.textContent)).toEqual(['Cancel', 'Delete all']);
    expect(document.activeElement).toBe(buttons[0]);
  });

  it('R13 one project reads "Delete all 1 project?"', async () => {
    show({ projects: ['a'] });
    await userEvent.click(deleteAll());
    expect(await screen.findByRole('dialog', { name: 'Delete all 1 project?' })).toBeTruthy();
  });

  it('R13 the button is busy while the list is read, so a double click gives one list read and one dialog', async () => {
    let release: (result: StoreResult<ProjectSummary[]>) => void = () => undefined;
    const store = show({ listProjects: () => new Promise((resolve) => void (release = resolve)) });
    fireEvent.click(deleteAll());
    expect(deleteAll().getAttribute('aria-busy')).toBe('true');
    fireEvent.click(deleteAll());
    expect(store.listProjects).toHaveBeenCalledTimes(1);
    release({ ok: true, value: [summary('a')] });
    expect(await screen.findByRole('dialog')).toBeTruthy();
    expect(screen.getAllByRole('dialog')).toHaveLength(1);
  });

  it('R13 Cancel and Escape close an idle dialog without deleting, and the focus returns to the button', async () => {
    const store = show({ projects: ['a'] });
    await userEvent.click(deleteAll());
    await screen.findByRole('dialog');
    await userEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(document.activeElement).toBe(deleteAll());
    await userEvent.click(deleteAll());
    await screen.findByRole('dialog');
    await userEvent.keyboard('{Escape}');
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(store.deleteProjects).not.toHaveBeenCalled();
  });

  it('R13 Delete all deletes every listed project in list order with progress, cannot be dismissed meanwhile, then forgets the open project, reads the usage again and says all were deleted', async () => {
    let progress: ((done: number, total: number) => void) | undefined;
    let finish: () => void = () => undefined;
    let stored = ['newest', 'middle', 'oldest'];
    const store = show({
      listProjects: async () => ({ ok: true, value: stored.map(summary) }),
      deleteProjects: async (_ids, onProgress) => {
        progress = onProgress;
        await new Promise<void>((resolve) => void (finish = resolve));
        stored = [];
        return ok;
      },
    });
    await userEvent.click(deleteAll());
    await screen.findByRole('dialog');
    const estimatesBefore = store.estimateStorage.mock.calls.length;
    await userEvent.click(screen.getByRole('button', { name: 'Delete all' }));
    expect(store.deleteProjects).toHaveBeenCalledWith(['newest', 'middle', 'oldest'], expect.any(Function));
    expect(screen.getByRole('button', { name: 'Delete all' }).getAttribute('aria-busy')).toBe('true');
    act(() => progress?.(2, 3));
    expect(screen.getByRole('status').textContent).toBe('Deleted 2 of 3');
    await userEvent.keyboard('{Escape}');
    expect(screen.getByRole('dialog')).toBeTruthy();
    expect((screen.getByRole('button', { name: 'Cancel' }) as HTMLButtonElement).disabled).toBe(true);
    expect(store.saveAppSettings).not.toHaveBeenCalled();

    await act(async () => finish());
    expect(await within(usageGroup()).findByText('All projects were deleted.')).toBeTruthy();
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(store.saveAppSettings).toHaveBeenCalledWith({ lastOpenProjectId: null });
    expect(store.estimateStorage.mock.calls.length).toBeGreaterThan(estimatesBefore);
  });

  it('R13 when the list is not empty after the purge (a project made elsewhere meanwhile) it says how many remain', async () => {
    const calls: string[][] = [[], []];
    let listed = 0;
    show({
      listProjects: async () => ({ ok: true, value: [summary('a'), ...(listed++ === 0 ? [] : calls[0]!.map(summary))] }),
      deleteProjects: async () => {
        calls[0]!.push('new-in-other-tab');
        return ok;
      },
    });
    await userEvent.click(deleteAll());
    await userEvent.click(await screen.findByRole('button', { name: 'Delete all' }));
    expect(await within(usageGroup()).findByText('2 projects remain.')).toBeTruthy();
  });

  it('R13 a delete that fails after some projects shows how many were deleted and the reason, reads the usage again, and the button works again', async () => {
    const store = show({
      projects: ['a', 'b', 'c', 'd', 'e'],
      deleteProjects: async (_ids, onProgress) => {
        onProgress?.(2, 5);
        return storeFailure('storage-unavailable', 'The disk is not available.');
      },
    });
    await userEvent.click(deleteAll());
    const estimatesBefore = store.estimateStorage.mock.calls.length;
    await userEvent.click(await screen.findByRole('button', { name: 'Delete all' }));
    expect(await within(usageGroup()).findByText('Deleted 2 of 5. The disk is not available.')).toBeTruthy();
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(store.estimateStorage.mock.calls.length).toBeGreaterThan(estimatesBefore);
    expect((deleteAll() as HTMLButtonElement).disabled).toBe(false);
    expect(deleteAll().getAttribute('aria-busy')).toBeNull();
  });

  it('R13 when the list cannot be read after the purge, it shows that failure and does not claim that all were deleted', async () => {
    let reads = 0;
    show({
      listProjects: async () => (reads++ === 0 ? { ok: true, value: [summary('a')] } : storeFailure('storage-unavailable', 'The browser would not list the projects.')),
    });
    await userEvent.click(deleteAll());
    await userEvent.click(await screen.findByRole('button', { name: 'Delete all' }));
    expect(await within(usageGroup()).findByText('The browser would not list the projects.')).toBeTruthy();
    expect(screen.queryByText('All projects were deleted.')).toBeNull();
  });

  it('R13 the dialog stays busy until the usage is read again, so a new purge cannot overlap it', async () => {
    let release: () => void = () => undefined;
    const store = show({ projects: ['a'] });
    await userEvent.click(deleteAll());
    await screen.findByRole('dialog');
    store.estimateStorage.mockImplementationOnce(() => new Promise((resolve) => void (release = () => resolve({ usedBytes: 1, quotaBytes: 2 }))));
    await userEvent.click(screen.getByRole('button', { name: 'Delete all' }));
    await waitFor(() => expect(store.deleteProjects).toHaveBeenCalledTimes(1));
    await waitFor(() => expect(store.estimateStorage.mock.calls.length).toBeGreaterThan(1));
    expect(screen.getByRole('dialog')).toBeTruthy(); // the re-read is still waiting
    await act(async () => release());
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
  });

  it('R13 a project list that cannot be read shows its message and the button works again', async () => {
    const store = show({ listProjects: async () => storeFailure('storage-unavailable', 'The browser would not list the projects.') });
    await userEvent.click(deleteAll());
    expect(await within(usageGroup()).findByText('The browser would not list the projects.')).toBeTruthy();
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(deleteAll().getAttribute('aria-busy')).toBeNull();
    expect(store.deleteProjects).not.toHaveBeenCalled();
  });
});

describe('StorageSection app text (shared/materialgen-prep R53)', () => {
  it('R53 the delete-all text and the closing note come from the app, not from the shell', async () => {
    const store = {
      estimateStorage: vi.fn(async () => null),
      requestPersistence: vi.fn(async () => true),
      listProjects: vi.fn(async () => ({ ok: true as const, value: [] })),
      deleteProjects: vi.fn(),
      saveAppSettings: vi.fn(),
    };
    render(<StorageSection store={store as never} projectImport={idleImport()} deleteAllText={DELETE_ALL_TEXT} note="Kept apart from the other app." />);
    expect(screen.getByRole('heading', { level: 3, name: 'Other apps' })).toBeTruthy();
    expect(screen.getByText('Kept apart from the other app.')).toBeTruthy();
    await waitFor(() => expect(store.estimateStorage).toHaveBeenCalled());
  });
});
