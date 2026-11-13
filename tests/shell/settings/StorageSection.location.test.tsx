// @vitest-environment jsdom
import { cleanup, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { StorageEstimate, StorageLocation } from '../../../src/projects/storage/storageHealth';
import type { ProjectImportState } from '../../../src/projects/ui/ImportProjectButton';
import { StorageSection } from '../../../src/shell/settings/StorageSection';

afterEach(cleanup);

const MIB = 1024 * 1024;
const GIB = 1024 * MIB;
const ok = { ok: true as const, value: undefined };
const idleImport: ProjectImportState = { importing: false, progress: null, message: null, error: null, start: vi.fn(async () => undefined) };

function show(options: { estimate?: StorageEstimate | null; change?: StorageLocation['change'] } = {}) {
  const location: StorageLocation = {
    path: 'D:\\Library',
    showInFolder: vi.fn(async () => undefined),
    change: vi.fn(options.change ?? (async () => 'cancelled' as const)),
  };
  const store = {
    estimateStorage: vi.fn(async () => (options.estimate === undefined ? { usedBytes: 0, quotaBytes: 12 * GIB } : options.estimate)),
    requestPersistence: vi.fn(async () => true),
    listProjects: vi.fn(async () => ({ ok: true as const, value: [] })),
    deleteProjects: vi.fn(async () => ok),
    saveAppSettings: vi.fn(async () => ok),
  };
  render(<StorageSection store={store} projectImport={idleImport} deleteAllText="Everything is removed." location={location} />);
  return { location, store };
}

describe('StorageSection in the desktop app (storage-backends R10)', () => {
  it('R10 shows the library folder\'s path with Show in folder and Change folder', async () => {
    const { location } = show();
    const group = screen.getByRole('group', { name: 'Library folder' });
    expect(within(group).getByText('D:\\Library')).toBeTruthy();
    await userEvent.click(within(group).getByRole('button', { name: 'Show in folder' }));
    expect(location.showInFolder).toHaveBeenCalledOnce();
    expect(within(group).getByRole('button', { name: 'Change folder' })).toBeTruthy();
  });

  it('R10 the persistence and quota lines are replaced by the free disk space', async () => {
    show();
    await waitFor(() => expect(screen.getByText('12 GB free')).toBeTruthy());
    expect(screen.queryByText(/used/)).toBeNull();
    expect(screen.queryByRole('group', { name: 'Keep my data' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Keep my data' })).toBeNull();
    expect(screen.getByRole('button', { name: 'Delete all data' })).toBeTruthy();
    expect(screen.getByRole('group', { name: 'Import project' })).toBeTruthy();
  });

  it('R10 a disk that does not say how much is free reads "Free space unknown"', async () => {
    const { store } = show({ estimate: null });
    await waitFor(() => expect(store.estimateStorage).toHaveBeenCalled());
    expect(await screen.findByText('Free space unknown')).toBeTruthy();
  });

  it('R10 under 200 MiB free shows the low-space warning in disk words, and plenty of room shows none', async () => {
    cleanup();
    show({ estimate: { usedBytes: 0, quotaBytes: 100 * MIB } });
    expect(await screen.findByText('The disk is almost full: 100 MB free.')).toBeTruthy();
    cleanup();
    show();
    await waitFor(() => expect(screen.getByText('12 GB free')).toBeTruthy());
    expect(screen.queryByText(/almost full/)).toBeNull();
  });

  it('R10 Change folder first says nothing is moved or copied, and Cancel changes nothing', async () => {
    const { location } = show();
    await userEvent.click(screen.getByRole('button', { name: 'Change folder' }));
    const dialog = await screen.findByRole('dialog');
    expect(within(dialog).getByText('Your projects stay where they are. The app will open the folder you choose, with the projects already in it. Nothing is moved or copied.')).toBeTruthy();
    await userEvent.click(within(dialog).getByRole('button', { name: 'Cancel' }));
    expect(location.change).not.toHaveBeenCalled();
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('R10 Choose folder opens the native dialog once; a closed dialog leaves no message', async () => {
    const { location } = show({ change: async () => 'cancelled' });
    await userEvent.click(screen.getByRole('button', { name: 'Change folder' }));
    await userEvent.click(within(await screen.findByRole('dialog')).getByRole('button', { name: 'Choose folder' }));
    await waitFor(() => expect(location.change).toHaveBeenCalledOnce());
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
    expect(within(screen.getByRole('group', { name: 'Library folder' })).queryByRole('status')).toBeNull();
  });

  it('R10 a folder the desktop side refuses shows its reason in the Library folder group', async () => {
    show({ change: async () => ({ refused: 'The Windows folder cannot be the library.' }) });
    await userEvent.click(screen.getByRole('button', { name: 'Change folder' }));
    await userEvent.click(within(await screen.findByRole('dialog')).getByRole('button', { name: 'Choose folder' }));
    const group = screen.getByRole('group', { name: 'Library folder' });
    expect(await within(group).findByText('The Windows folder cannot be the library.')).toBeTruthy();
  });

  it('R10 a change that went through leaves the page to reload and shows no message', async () => {
    show({ change: async () => 'changed' });
    await userEvent.click(screen.getByRole('button', { name: 'Change folder' }));
    await userEvent.click(within(await screen.findByRole('dialog')).getByRole('button', { name: 'Choose folder' }));
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
    expect(within(screen.getByRole('group', { name: 'Library folder' })).queryByRole('status')).toBeNull();
  });

  it('R10 with no location (the browser) none of the desktop lines appear', async () => {
    const store = {
      estimateStorage: vi.fn(async () => ({ usedBytes: 412 * MIB, quotaBytes: 8 * GIB })),
      requestPersistence: vi.fn(async () => true),
      listProjects: vi.fn(async () => ({ ok: true as const, value: [] })),
      deleteProjects: vi.fn(async () => ok),
      saveAppSettings: vi.fn(async () => ok),
    };
    render(<StorageSection store={store} projectImport={idleImport} deleteAllText="Everything is removed." />);
    await waitFor(() => expect(screen.getByText('412 MB of 8 GB used')).toBeTruthy());
    expect(screen.queryByRole('group', { name: 'Library folder' })).toBeNull();
    expect(screen.getByRole('group', { name: 'Keep my data' })).toBeTruthy();
  });
});
