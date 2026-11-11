// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import type { ComponentProps } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { storeFailure } from '@shared/projects';
import { AppBackendsProvider, setRouteGuard } from '@shared/shell';
import { MaterialProjectView } from '@mat/app/project/MaterialProjectView';
import { encodePng } from '../../../../src/materialgen/maps/png/pngCodec';
import { createMemoryVaultStorage } from '../../../keys/memoryVaultStorage';
import { createTestMaterialStore, png, type TestMaterialStore } from '../../storage/materialStoreFixtures';

const lockState = vi.hoisted(() => ({ held: true }));
vi.mock('@shared/projects', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@shared/projects')>()),
  acquireProjectLock: vi.fn(async () => ({ held: lockState.held, release: vi.fn() })),
}));

// jsdom has no WebGL; the 3D preview is tested in tests/materialgen/preview. The stand-in shows the mask state the view hands it and lets a test flip it.
vi.mock('@mat/preview/ui/PreviewViewport', () => ({
  PreviewViewport: ({ masks }: { masks: { overlay: boolean; palette: unknown; onOverlayChange(on: boolean): void; onPanelOpenChange(open: boolean): void } }) => (
    <div data-testid="preview-viewport" data-overlay={String(masks.overlay)} data-palette={masks.palette === null ? 'none' : 'some'}>
      <button type="button" onClick={() => masks.onOverlayChange(true)}>stand-in overlay on</button>
    </div>
  ),
}));

afterEach(() => {
  cleanup();
  setRouteGuard(null);
  window.location.hash = '';
});

let test: TestMaterialStore;
let projectId: string;

beforeEach(async () => {
  lockState.held = true;
  test = await createTestMaterialStore();
  const made = await test.store.createProject({ name: 'Bricks', size: 1024 });
  if (!made.ok) throw new Error('setup');
  projectId = made.value.id;
});

// The left panel reads the key vault and the provider adapters from the app's backends.
const view = (store: ComponentProps<typeof MaterialProjectView>['store'], id: string) => (
  <AppBackendsProvider backends={{ createImageGenerator: vi.fn(), createPromptEnhancer: vi.fn(), vaultStorage: createMemoryVaultStorage(), kdfIterations: 1000, appId: 'material-lab' }}>
    <MaterialProjectView store={store} projectId={id} />
  </AppBackendsProvider>
);
const open = () => render(view(test.store, projectId));

describe('materialgen/app project view', () => {
  it('R10 R14 R20 it draws the top bar, the left panel, the viewport and the right panel with the project loaded', async () => {
    open();
    expect(await screen.findByLabelText('Prompt')).toBeTruthy();
    for (const id of ['shell-top', 'shell-left', 'shell-viewport', 'shell-right']) expect(screen.getByTestId(id)).toBeTruthy();
    expect(screen.getAllByTestId('slot-card')).toHaveLength(5);
  });

  it('R14 R20 as in the projection app, the left panel holds the material (slot cards, no name field) and the right panel holds Generate', async () => {
    open();
    await screen.findByLabelText('Prompt');
    const left = within(screen.getByTestId('shell-left'));
    const right = within(screen.getByTestId('shell-right'));
    expect(screen.queryByLabelText('Project name')).toBeNull();
    expect(left.getAllByTestId('slot-card')).toHaveLength(5);
    expect(left.queryByRole('button', { name: 'Generate' })).toBeNull();
    expect(right.getByRole('button', { name: 'Generate' })).toBeTruthy();
    expect(right.getByRole('button', { name: /Custom setup/ })).toBeTruthy();
    expect(right.queryByTestId('slot-card')).toBeNull();
  });

  it('R28 R40 the viewport gets the mask switch (off at the start, session only) and no palette for a material without masks', async () => {
    open();
    const viewport = await screen.findByTestId('preview-viewport');
    expect(viewport.getAttribute('data-overlay')).toBe('false');
    expect(viewport.getAttribute('data-palette')).toBe('none');
    fireEvent.click(screen.getByText('stand-in overlay on'));
    await waitFor(() => expect(screen.getByTestId('preview-viewport').getAttribute('data-overlay')).toBe('true'));
  });

  it('R11 the top bar has Projects, Export material and Settings in the middle, and shows the project name on the left', async () => {
    open();
    const bar = screen.getByTestId('top-bar');
    expect(within(bar).getAllByRole('button').map((button) => button.getAttribute('aria-label'))).toEqual(['Projects', 'Export material', 'Settings']);
    expect([...bar.children].map((child) => child.getAttribute('data-region'))).toEqual(['name', 'actions']);
    await waitFor(() => expect(bar.querySelector('[data-region="name"]')?.textContent).toBe('Bricks'));
  });

  it('R11 Export material in the top bar is disabled with its reason while no map exists, and the Maps heading has no export button', async () => {
    open();
    const bar = screen.getByTestId('top-bar');
    await waitFor(() => expect(bar.querySelector('[data-region="name"]')?.textContent).toBe('Bricks'));
    const button = within(bar).getByRole('button', { name: 'Export material' }) as HTMLButtonElement;
    expect(button.disabled).toBe(true);
    expect(button.getAttribute('title')).toContain('There is nothing to export yet.');
    expect(screen.getAllByRole('button', { name: 'Export material' })).toHaveLength(1);
  });

  it('R11 until the project has loaded the top bar shows the placeholder app name', () => {
    open();
    expect(screen.getByTestId('top-bar').querySelector('[data-region="name"]')?.textContent).toBe('material-lab');
  });

  it('R12b while the project reads, the viewport shows the loading overlay', () => {
    open();
    expect(screen.getByTestId('loading-overlay')).toBeTruthy();
  });

  it('R12b a project that does not open shows why in the viewport', async () => {
    render(view(test.store, 'missing'));
    expect((await screen.findByRole('alert')).textContent).not.toBe('');
  });

  it('R13 when another tab holds the project it opens read-only with the banner and no edits', async () => {
    lockState.held = false;
    open();
    expect(await screen.findByText(/open in another tab/)).toBeTruthy();
    expect((screen.getByLabelText('Prompt') as HTMLTextAreaElement).disabled).toBe(true);
  });

  it('R12 Projects writes the waiting change, forgets the open project and goes to the list', async () => {
    open();
    const prompt = (await screen.findByLabelText('Prompt')) as HTMLTextAreaElement;
    await waitFor(() => expect(prompt.disabled).toBe(false)); // the lock answered
    fireEvent.change(prompt, { target: { value: 'mossy' } });
    fireEvent.click(within(screen.getByTestId('top-bar')).getByRole('button', { name: 'Projects' }));
    await waitFor(() => expect(window.location.hash).toBe('#/projects'));
    const saved = await test.store.loadProject(projectId);
    expect(saved.ok && saved.value.prompt).toBe('mossy');
    expect((await test.store.loadAppSettings()).lastOpenProjectId).toBeNull();
  });

  it('R34 R29 a PNG dropped on a card is stored as the map and its record, and shown on the card', async () => {
    const made = await test.store.createProject({ name: 'Small', size: 256 });
    if (!made.ok) throw new Error('setup');
    render(view(test.store, made.value.id));
    const card = (await screen.findAllByTestId('slot-card'))[1]!; // Normal
    await waitFor(() => expect((within(card).getByRole('button', { name: 'Choose image' }) as HTMLButtonElement).disabled).toBe(false)); // the lock answered
    const dropped = encodePng({ width: 2, height: 2, channels: 3, data: new Uint8Array(12).fill(128) });
    const file = new File([dropped as BlobPart], 'n.png', { type: 'image/png' });
    fireEvent.drop(card.querySelector('.map-half__drop')!, { dataTransfer: { types: ['Files'], files: [file] } });
    await waitFor(async () => {
      const saved = await test.store.loadProject(made.value.id);
      expect(saved.ok && saved.value.maps.normal?.workingKey).toBeTruthy();
    }, { timeout: 8000 }); // decoding, resizing and encoding run on the main thread, which a full test run keeps busy
    const saved = await test.store.loadProject(made.value.id);
    if (!saved.ok) throw new Error('load');
    expect((await test.store.readBlob(made.value.id, saved.value.maps.normal!.workingKey))?.size).toBeGreaterThan(0);
    expect(within(card).getByTestId('map-caption').getAttribute('title')).toBe('Normal 256 x 256 · Dropped: n.png');
  }, 15000);

  it('R30 a file dropped while the opening sweep is still running waits: nothing is written until the sweep has finished', async () => {
    const made = await test.store.createProject({ name: 'Racing', size: 256 });
    if (!made.ok) throw new Error('setup');
    let finishSweep: () => void = () => undefined;
    const writeBlob = vi.fn(test.store.writeBlob);
    const slow = {
      ...test.store,
      writeBlob,
      sweepOrphanBlobs: vi.fn(async (id: string) => {
        await new Promise<void>((resolve) => (finishSweep = resolve)); // the sweep has read the record but not yet listed the files
        return test.store.sweepOrphanBlobs(id);
      }),
    };
    render(view(slow, made.value.id));
    const card = (await screen.findAllByTestId('slot-card'))[1]!;
    await waitFor(() => expect(slow.sweepOrphanBlobs).toHaveBeenCalled());
    const dropped = encodePng({ width: 2, height: 2, channels: 3, data: new Uint8Array(12).fill(128) });
    fireEvent.drop(card.querySelector('.map-half__drop')!, { dataTransfer: { types: ['Files'], files: [new File([dropped as BlobPart], 'n.png', { type: 'image/png' })] } });
    await new Promise((resolve) => setTimeout(resolve, 300)); // the drop is waiting for the sweep
    expect(writeBlob).not.toHaveBeenCalled();
    finishSweep();
    await waitFor(async () => {
      const saved = await test.store.loadProject(made.value.id);
      expect(saved.ok && saved.value.maps.normal?.workingKey).toBeTruthy();
    }, { timeout: 8000 });
    const saved = await test.store.loadProject(made.value.id);
    if (!saved.ok) throw new Error('load');
    expect(await test.store.readBlob(made.value.id, saved.value.maps.normal!.workingKey)).not.toBeNull();
  }, 15000);

  it('R29 when the record cannot be stored after a drop, the card stays empty, the message says why, and the new file is not kept', async () => {
    const made = await test.store.createProject({ name: 'Small', size: 256 });
    if (!made.ok) throw new Error('setup');
    const failing = { ...test.store, saveProject: vi.fn(async () => storeFailure('storage-unavailable', 'The record could not be stored.')) };
    render(view(failing, made.value.id));
    const card = (await screen.findAllByTestId('slot-card'))[1]!; // Normal
    await waitFor(() => expect((within(card).getByRole('button', { name: 'Choose image' }) as HTMLButtonElement).disabled).toBe(false));
    const dropped = encodePng({ width: 2, height: 2, channels: 3, data: new Uint8Array(12).fill(128) });
    const file = new File([dropped as BlobPart], 'n.png', { type: 'image/png' });
    fireEvent.drop(card.querySelector('.map-half__drop')!, { dataTransfer: { types: ['Files'], files: [file] } });
    expect((await screen.findByRole('alert', {}, { timeout: 8000 })).textContent).toContain('The record could not be stored.');
    expect(within(card).getByRole('button', { name: 'Choose image' })).toBeTruthy();
    expect(within(card).queryByText('Missing file')).toBeNull();
    await new Promise((resolve) => setTimeout(resolve, 600)); // past the autosave delay: nothing queued may write the map later
    const later = failing.saveProject.mock.calls.slice(1).map((call) => (call as unknown[])[0] as { maps: object }); // the first call is the failed attempt itself
    expect(later.every((record) => Object.keys(record.maps).length === 0)).toBe(true);
  }, 15000);

  it('R30 R34 opening a project whose map file is gone names the map and drops an unreadable undo', async () => {
    const made = await test.store.createProject({ name: 'Gone', size: 256 });
    if (!made.ok) throw new Error('setup');
    const id = made.value.id;
    const loaded = await test.store.loadProject(id);
    if (!loaded.ok) throw new Error('load');
    await test.store.writeBlob(id, 'maps/n0.png', png(1));
    await test.store.saveProject({
      ...loaded.value,
      maps: { normal: { originalKey: 'maps/n0.png', workingKey: 'maps/n0.png', undoKey: 'maps/u0.png', undo: { label: 'Filter' }, width: 256, height: 256 } },
    });
    render(view(test.store, id));
    await waitFor(async () => {
      const saved = await test.store.loadProject(id);
      expect(saved.ok && saved.value.maps.normal?.undoKey).toBeNull(); // the entry is gone from the record
    }, { timeout: 8000 });
  }, 15000);

  it('R10 while the Custom setup overlay is open the top bar, the left panel and the right panel are inert, and they come back when it closes', async () => {
    open();
    await screen.findByLabelText('Prompt');
    const parts = ['shell-top', 'shell-left', 'shell-right'].map((id) => screen.getByTestId(id));
    parts.forEach((part) => expect(part.hasAttribute('inert')).toBe(false));
    fireEvent.click(screen.getByRole('button', { name: /Custom setup/ }));
    await waitFor(() => parts.forEach((part) => expect(part.hasAttribute('inert')).toBe(true)));
    expect(screen.getByTestId('shell-viewport').hasAttribute('inert')).toBe(false); // the overlay lives in the viewport
    fireEvent.click(screen.getByRole('button', { name: /Cancel/ }));
    await waitFor(() => parts.forEach((part) => expect(part.hasAttribute('inert')).toBe(false)));
  });

  it('R9 opening a project makes it the one reopened at the next start, and Settings keeps it', async () => {
    open();
    await waitFor(async () => expect((await test.store.loadAppSettings()).lastOpenProjectId).toBe(projectId));
    fireEvent.click(within(screen.getByTestId('top-bar')).getByRole('button', { name: 'Settings' }));
    await waitFor(() => expect(window.location.hash).toBe('#/settings/keys'));
    expect((await test.store.loadAppSettings()).lastOpenProjectId).toBe(projectId);
  });
});
