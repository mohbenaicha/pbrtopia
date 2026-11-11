// @vitest-environment jsdom
import { act, cleanup, fireEvent, screen, waitFor, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { startMaterialApp } from '@mat/app';
import { DELETE_EFFECT } from '@mat/app/MaterialApp';
import { createMemoryVaultStorage } from '../../../keys/memoryVaultStorage';
import { createTestMaterialStore } from '../../storage/materialStoreFixtures';

vi.mock('@mat/preview/ui/PreviewViewport', () => ({ PreviewViewport: () => null }));

let stop: (() => void) | undefined;
let root: HTMLElement;
beforeEach(() => {
  root = document.createElement('div');
  document.body.append(root);
  window.location.hash = '';
});
afterEach(() => {
  act(() => stop?.());
  stop = undefined;
  root.remove();
  cleanup();
  window.location.hash = '';
});

const gl = { MAX_TEXTURE_SIZE: 1, getParameter: () => 4096, getExtension: () => ({}) };
const env = { gl: gl as never, hasOpfs: true, hasIndexedDb: true, hasWebLocks: true, hasWorkers: true };
const backends = () => ({ createImageGenerator: vi.fn(), createPromptEnhancer: vi.fn(), vaultStorage: createMemoryVaultStorage(), kdfIterations: 1000, appId: 'material-lab' });

async function openList(names: string[]) {
  const test = await createTestMaterialStore();
  for (const name of names) {
    const made = await test.store.createProject({ name, size: 1024 });
    if (!made.ok) throw new Error(made.error.message);
    test.advance(1);
  }
  await act(async () => void (stop = await startMaterialApp(root, { openStore: async () => ({ ok: true, value: test.store }), backends: backends(), capabilityEnv: env })));
  await screen.findByText(names[0]!);
  return test;
}
const confirmDelete = (): void => void fireEvent.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Delete' }));
const card = (name: string): HTMLElement => screen.getByText(name).closest('li, article, [data-testid]') as HTMLElement;

describe('materialgen/app R23b the project list', () => {
  it('R23b Open goes to that project\'s address', async () => {
    await openList(['Mossy brick']);
    fireEvent.click(screen.getByRole('button', { name: 'Open' }));
    await waitFor(() => expect(window.location.hash).toBe('#/p/id-1'));
  });

  it('R23b deleting one asks first, in this app\'s words, and Cancel keeps it', async () => {
    const test = await openList(['Mossy brick', 'Wet slate']);
    fireEvent.click(within(card('Mossy brick')).getByRole('button', { name: 'Delete' }));
    expect(screen.getByText(`"Mossy brick": ${DELETE_EFFECT}`)).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(await test.store.listProjects()).toMatchObject({ ok: true, value: expect.arrayContaining([expect.objectContaining({ name: 'Mossy brick' })]) });
    expect(screen.getByText('Mossy brick')).toBeTruthy();
  });

  it('R23b confirming deletes that project and leaves the other', async () => {
    const test = await openList(['Mossy brick', 'Wet slate']);
    fireEvent.click(within(card('Mossy brick')).getByRole('button', { name: 'Delete' }));
    confirmDelete();
    await waitFor(() => expect(screen.queryByText('Mossy brick')).toBeNull());
    const listed = await test.store.listProjects();
    expect(listed.ok && listed.value.map((project) => project.name)).toEqual(['Wet slate']);
  });

  it('R23b Select all then Delete selected deletes every project after one confirmation', async () => {
    const test = await openList(['Mossy brick', 'Wet slate']);
    fireEvent.click(screen.getByRole('checkbox', { name: 'Select all' }));
    fireEvent.click(screen.getByRole('button', { name: 'Delete selected' }));
    expect(screen.getByText(`2 projects: ${DELETE_EFFECT}`)).toBeTruthy();
    confirmDelete();
    await waitFor(async () => {
      const listed = await test.store.listProjects();
      expect(listed.ok && listed.value.length).toBe(0);
    });
  });

  it('R23b Rename saves the new name to the store', async () => {
    const test = await openList(['Mossy brick']);
    fireEvent.click(screen.getByRole('button', { name: 'Rename' }));
    fireEvent.change(screen.getByLabelText('Project name'), { target: { value: 'Mossy bricks' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save' }));
    await waitFor(async () => {
      const listed = await test.store.listProjects();
      expect(listed.ok && listed.value[0]?.name).toBe('Mossy bricks');
    });
  });
});
