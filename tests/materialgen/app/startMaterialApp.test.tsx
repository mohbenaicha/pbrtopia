// @vitest-environment jsdom
import { act, cleanup, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { startMaterialApp } from '@mat/app';
import type { CapabilityEnv } from '@mat/app/capabilities/detectCapabilities';
import { createMemoryVaultStorage } from '../../keys/memoryVaultStorage';
import { createTestMaterialStore } from '../storage/materialStoreFixtures';

const lock = vi.hoisted(() => ({ held: true }));
vi.mock('@shared/projects', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@shared/projects')>()),
  acquireProjectLock: vi.fn(async () => ({ held: lock.held, release: vi.fn() })),
}));

vi.mock('@mat/preview/ui/PreviewViewport', () => ({ PreviewViewport: () => null })); // jsdom has no WebGL; the 3D preview is tested in tests/materialgen/preview

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
const fullEnv = (patch: Partial<CapabilityEnv> = {}): CapabilityEnv => ({ gl: gl as never, hasOpfs: true, hasIndexedDb: true, hasWebLocks: true, hasWorkers: true, ...patch });
const backends = () => ({ createImageGenerator: vi.fn(), createPromptEnhancer: vi.fn(), vaultStorage: createMemoryVaultStorage(), kdfIterations: 1000, appId: 'material-lab' });

describe('materialgen/app start', () => {
  it('R6a a browser that lacks a feature gets only the missing-features page, and no store is opened', async () => {
    const openStore = vi.fn();
    await act(async () => void (stop = await startMaterialApp(root, { openStore, backends: backends(), capabilityEnv: fullEnv({ hasOpfs: false }) })));
    expect(screen.getByTestId('missing-features')).toBeTruthy();
    expect(openStore).not.toHaveBeenCalled();
    expect(screen.queryByText('Projects')).toBeNull();
  });

  it('R6a R9 a capable browser lands on the project list, and asks for persistent storage (R8)', async () => {
    const { store } = await createTestMaterialStore();
    const persistence = vi.spyOn(store, 'requestPersistence');
    await act(async () => void (stop = await startMaterialApp(root, { openStore: async () => ({ ok: true, value: store }), backends: backends(), capabilityEnv: fullEnv() })));
    expect(await screen.findByRole('heading', { name: 'Projects' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'New project' })).toBeTruthy();
    expect(screen.getByRole('button', { name: /Import project/ })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Settings' })).toBeTruthy();
    expect(persistence).toHaveBeenCalledTimes(1);
    expect(window.location.hash).toBe('#/projects');
  });

  it('R9 the start address reopens the project that was open when the app was closed', async () => {
    const { store } = await createTestMaterialStore();
    const made = await store.createProject({ name: 'Bricks', size: 512 });
    if (!made.ok) throw new Error('setup');
    await store.saveAppSettings({ lastOpenProjectId: made.value.id });
    await act(async () => void (stop = await startMaterialApp(root, { openStore: async () => ({ ok: true, value: store }), backends: backends(), capabilityEnv: fullEnv() })));
    await waitFor(() => expect(window.location.hash).toBe(`#/p/${made.value.id}`));
    expect(await screen.findByLabelText('Prompt')).toBeTruthy(); // the project is open when its Generate panel is drawn
  });

  it('R9 a project that no longer exists lands on the list with a line saying why', async () => {
    const { store } = await createTestMaterialStore();
    window.location.hash = '#/p/gone';
    await act(async () => void (stop = await startMaterialApp(root, { openStore: async () => ({ ok: true, value: store }), backends: backends(), capabilityEnv: fullEnv() })));
    expect(await screen.findByText('That project no longer exists.')).toBeTruthy();
  });

  it('R9 a store that cannot be opened shows its reason', async () => {
    await act(async () => void (stop = await startMaterialApp(root, { openStore: async () => ({ ok: false, error: { code: 'storage-unavailable', message: 'No storage.' } }), backends: backends(), capabilityEnv: fullEnv() })));
    expect(screen.getByRole('alert').textContent).toBe('No storage.');
  });
});
