// @vitest-environment jsdom
import { act, cleanup, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { ProjectSummary } from '../../../src/projects/records/projectRecords';
import type { ListExportResult, ProjectListExporter } from '../../../src/projects/ui/listExport';
import { ProjectListView, type ListViewStore } from '../../../src/projects/ui/ProjectListView';

beforeEach(() => {
  URL.createObjectURL = vi.fn(() => 'blob:thumb');
  URL.revokeObjectURL = vi.fn();
});
afterEach(cleanup);

const summary = (id: string, name: string, extra: Partial<ProjectSummary> = {}): ProjectSummary => ({ id, name, updatedAt: '2026-10-18T10:00:00.000Z', triangleCount: 10, ...extra });
const DONE: ListExportResult = { kind: 'done', note: null };

function fakeStore(initial: ProjectSummary[]): ListViewStore {
  return {
    listProjects: vi.fn(async () => ({ ok: true as const, value: [...initial] })),
    renameProject: vi.fn(async () => ({ ok: true as const, value: undefined })),
    deleteProjects: vi.fn(async () => ({ ok: true as const, value: undefined })),
    loadThumbnail: vi.fn(async () => null),
  };
}

/** A promise the test settles by hand, to look at the list while an export is still running. */
function gate<T>() {
  let release!: (value: T) => void;
  const promise = new Promise<T>((resolve) => void (release = resolve));
  return { promise, release };
}

async function showList(projects: ProjectSummary[], exporter: ProjectListExporter | undefined) {
  render(<ProjectListView store={fakeStore(projects)} onOpen={vi.fn()} {...(exporter === undefined ? {} : { exporter })} />);
  await screen.findByText(projects[0]!.name);
}

const exporterOf = (overrides: Partial<ProjectListExporter> = {}): ProjectListExporter => ({
  exportOne: vi.fn(async () => DONE),
  openBatch: vi.fn(async () => ({ toFolder: true, exportInto: vi.fn(async () => DONE) })),
  ...overrides,
});
const exportButton = (name: string): HTMLButtonElement => screen.getByRole('button', { name: `Export ${name}` });
const selectAll = async (): Promise<void> => void (await userEvent.click(screen.getByRole('checkbox', { name: 'Select all' })));

describe('ProjectListView export of one project (app/projects R16)', () => {
  it('R16 a card has an Export button named for its project with the tooltip "Export project", only when the app gives an exporter', async () => {
    await showList([summary('a', 'Orc helmet')], exporterOf());
    expect(exportButton('Orc helmet').title).toBe('Export project');
    cleanup();
    await showList([summary('a', 'Orc helmet')], undefined);
    expect(screen.queryByRole('button', { name: /^Export / })).toBeNull();
  });

  it('R16 the export message floats over the page, so it takes no room in the list', async () => {
    const exportOne = vi.fn(async () => ({ kind: 'done', note: null }) as ListExportResult);
    await showList([summary('a', 'Orc helmet')], exporterOf({ exportOne }));
    await userEvent.click(exportButton('Orc helmet'));
    const message = await screen.findByRole('status', { name: '' });
    expect(message.classList.contains('project-list__report')).toBe(true);
  });

  it('R16 a failed export message floats over the page too', async () => {
    const exportOne = vi.fn(async () => ({ kind: 'failed', message: 'No room.' }) as ListExportResult);
    await showList([summary('a', 'Orc helmet')], exporterOf({ exportOne }));
    await userEvent.click(exportButton('Orc helmet'));
    const message = await screen.findByRole('alert');
    expect(message.classList.contains('project-list__report')).toBe(true);
  });

  it('R16 pressing it exports that project and a line says "Exported <name>." with the app\'s note', async () => {
    const exportOne = vi.fn(async () => ({ kind: 'done', note: '2 pictures were left out of the zip because their files are missing.' }) as ListExportResult);
    await showList([summary('a', 'Orc helmet'), summary('b', 'Bricks')], exporterOf({ exportOne }));
    await userEvent.click(exportButton('Bricks'));
    expect(exportOne).toHaveBeenCalledWith({ id: 'b', name: 'Bricks' });
    expect((await screen.findByRole('status', { name: '' })).textContent).toContain('Exported Bricks. 2 pictures were left out of the zip because their files are missing.');
  });

  it('R16 a failure shows "<name>: <reason>" as an alert', async () => {
    const exportOne = vi.fn(async () => ({ kind: 'failed', message: 'The project\'s file "maps/a.png" is missing, so it cannot be exported.' }) as ListExportResult);
    await showList([summary('a', 'Orc helmet')], exporterOf({ exportOne }));
    await userEvent.click(exportButton('Orc helmet'));
    expect((await screen.findByRole('alert')).textContent).toBe('Orc helmet: The project\'s file "maps/a.png" is missing, so it cannot be exported.');
  });

  it('R16 a closed save picker is not a failure and shows nothing', async () => {
    await showList([summary('a', 'Orc helmet')], exporterOf({ exportOne: vi.fn(async () => ({ kind: 'cancelled' }) as ListExportResult) }));
    await userEvent.click(exportButton('Orc helmet'));
    await waitFor(() => expect(exportButton('Orc helmet').disabled).toBe(false));
    expect(screen.queryByRole('alert')).toBeNull();
    expect(screen.queryByText(/^Exported/)).toBeNull();
  });

  it('R16 while one export runs it is busy, every Export button and every Delete is disabled, and Export selected too', async () => {
    const running = gate<ListExportResult>();
    await showList([summary('a', 'Orc helmet'), summary('b', 'Bricks')], exporterOf({ exportOne: vi.fn(() => running.promise) }));
    await userEvent.click(screen.getByRole('checkbox', { name: 'Select Orc helmet' }));
    await userEvent.click(exportButton('Bricks'));
    expect(exportButton('Bricks').getAttribute('aria-busy')).toBe('true');
    expect(exportButton('Orc helmet').disabled).toBe(true);
    for (const button of screen.getAllByRole('button', { name: 'Delete' })) expect((button as HTMLButtonElement).disabled).toBe(true);
    expect((screen.getByRole('button', { name: 'Delete selected' }) as HTMLButtonElement).disabled).toBe(true);
    expect((screen.getByRole('button', { name: 'Export selected' }) as HTMLButtonElement).disabled).toBe(true);
    await act(async () => running.release(DONE));
    await waitFor(() => expect(exportButton('Orc helmet').disabled).toBe(false));
  });

  it('R16 a project of an older version has Export disabled with its reason', async () => {
    await showList([summary('a', 'Old one', { unreadable: 'Saved by an older version.' })], exporterOf());
    expect(exportButton('Old one').disabled).toBe(true);
    expect(exportButton('Old one').title).toContain('Saved by an older version.');
  });
});

describe('ProjectListView export of the selection (app/projects R17)', () => {
  const three = [summary('a', 'A'), summary('b', 'B'), summary('c', 'C')];

  it('R17 Export selected sits beside Delete selected once something is selected', async () => {
    await showList(three, exporterOf());
    expect(screen.queryByRole('button', { name: 'Export selected' })).toBeNull();
    await userEvent.click(screen.getByRole('checkbox', { name: 'Select B' }));
    const bar = screen.getByText('1 selected').parentElement!;
    expect(within(bar).getByRole('button', { name: 'Export selected' })).toBeTruthy();
    expect(within(bar).getByRole('button', { name: 'Delete selected' })).toBeTruthy();
  });

  it('R17 it asks for the destination once, exports each selected project in the order the cards are shown, and says how many', async () => {
    const order: string[] = [];
    const exportInto = vi.fn(async (project: { id: string }) => (order.push(project.id), DONE));
    const openBatch = vi.fn(async () => ({ toFolder: true, exportInto }));
    await showList(three, exporterOf({ openBatch }));
    await userEvent.click(screen.getByRole('checkbox', { name: 'Select C' })); // picked first, shown last
    await userEvent.click(screen.getByRole('checkbox', { name: 'Select A' }));
    await userEvent.click(screen.getByRole('button', { name: 'Export selected' }));
    expect((await screen.findByRole('status', { name: '' })).textContent).toBe('Exported 2 projects.');
    expect(openBatch).toHaveBeenCalledTimes(1);
    expect(order).toEqual(['a', 'c']);
    expect(screen.getByText('2 selected')).toBeTruthy(); // the selection is kept
  });

  it('R17 while it runs the button reads "Exporting 1 of 2", Delete selected and every Export are disabled', async () => {
    const first = gate<ListExportResult>();
    const exportInto = vi.fn().mockReturnValueOnce(first.promise).mockResolvedValue(DONE);
    await showList(three, exporterOf({ openBatch: vi.fn(async () => ({ toFolder: true, exportInto })) }));
    await selectAll();
    await userEvent.click(screen.getByRole('button', { name: 'Export selected' }));
    const busy = await screen.findByRole('button', { name: 'Exporting 1 of 3' });
    expect(busy.getAttribute('aria-busy')).toBe('true');
    expect((screen.getByRole('button', { name: 'Delete selected' }) as HTMLButtonElement).disabled).toBe(true);
    expect(exportButton('A').disabled).toBe(true);
    await act(async () => first.release(DONE));
    await screen.findByText('Exported 3 projects.');
  });

  it('R17 a project that fails does not stop the others: "Exported 2 of 3 projects." and one line per failure', async () => {
    const exportInto = vi.fn(async (project: { id: string }): Promise<ListExportResult> => (project.id === 'b' ? { kind: 'failed', message: 'File "x" is missing.' } : DONE));
    await showList(three, exporterOf({ openBatch: vi.fn(async () => ({ toFolder: true, exportInto })) }));
    await selectAll();
    await userEvent.click(screen.getByRole('button', { name: 'Export selected' }));
    const line = await screen.findByRole('alert');
    expect(line.textContent).toContain('Exported 2 of 3 projects.');
    expect(line.textContent).toContain('B: File "x" is missing.');
    expect(exportInto).toHaveBeenCalledTimes(3);
  });

  it('R17 a project of an older version counts as a failure with its reason and is not exported', async () => {
    const exportInto = vi.fn(async () => DONE);
    await showList([summary('a', 'A'), summary('b', 'Old', { unreadable: 'Saved by an older version.' })], exporterOf({ openBatch: vi.fn(async () => ({ toFolder: true, exportInto })) }));
    await selectAll();
    await userEvent.click(screen.getByRole('button', { name: 'Export selected' }));
    expect((await screen.findByRole('alert')).textContent).toContain('Old: Saved by an older version.');
    expect(exportInto).toHaveBeenCalledTimes(1);
  });

  it('R17 a folder that refuses the write stops the batch and says so', async () => {
    const exportInto = vi.fn(async (): Promise<ListExportResult> => ({ kind: 'failed', message: 'Could not write to the folder.', stopBatch: true }));
    await showList(three, exporterOf({ openBatch: vi.fn(async () => ({ toFolder: true, exportInto })) }));
    await selectAll();
    await userEvent.click(screen.getByRole('button', { name: 'Export selected' }));
    const line = await screen.findByRole('alert');
    expect(line.textContent).toContain('Could not write to the folder.');
    expect(line.textContent).toContain('Exported 0 of 3 projects.');
    expect(exportInto).toHaveBeenCalledTimes(1);
  });

  it('R17 a closed folder picker exports nothing and shows nothing', async () => {
    await showList(three, exporterOf({ openBatch: vi.fn(async () => null) }));
    await selectAll();
    await userEvent.click(screen.getByRole('button', { name: 'Export selected' }));
    await waitFor(() => expect((screen.getByRole('button', { name: 'Export selected' }) as HTMLButtonElement).disabled).toBe(false));
    expect(screen.queryByRole('alert')).toBeNull();
    expect(screen.queryByText(/^Exported/)).toBeNull();
  });

  it('R17 where the zips go out as links the end line adds the advice about blocked downloads', async () => {
    const exportInto = vi.fn(async () => DONE);
    await showList(three, exporterOf({ openBatch: vi.fn(async () => ({ toFolder: false, exportInto })) }));
    await selectAll();
    await userEvent.click(screen.getByRole('button', { name: 'Export selected' }));
    expect((await screen.findByRole('status', { name: '' })).textContent).toContain('If your browser blocked some downloads, allow multiple downloads for this site and export again.');
  });

  it('R17 one selected project says "Exported 1 project."', async () => {
    await showList(three, exporterOf());
    await userEvent.click(screen.getByRole('checkbox', { name: 'Select A' }));
    await userEvent.click(screen.getByRole('button', { name: 'Export selected' }));
    expect((await screen.findByRole('status', { name: '' })).textContent).toBe('Exported 1 project.');
  });
});
