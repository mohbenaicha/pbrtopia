// @vitest-environment jsdom
import { readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { DEFAULT_APP_SETTINGS } from '@shared/projects';
import type { ProjectImportState } from '@shared/projects';
import { AppBackendsProvider, type SettingsStore } from '@shared/shell';
import { DESKTOP_DELETE_ALL_TEXT, MaterialSettingsView } from '@mat/app/settings/MaterialSettingsView';
import type { SettingsSection } from '@mat/app/routes/router';
import { createMemoryVaultStorage } from '../../../keys/memoryVaultStorage';

afterEach(cleanup);

const idleImport: ProjectImportState = { importing: false, progress: null, message: null, error: null, start: vi.fn(async () => undefined) };
const store = (): SettingsStore =>
  ({
    loadAppSettings: vi.fn(async () => DEFAULT_APP_SETTINGS),
    saveAppSettings: vi.fn(async () => ({ ok: true as const, value: undefined })),
    loadProject: vi.fn(),
    estimateStorage: vi.fn(async () => null),
    requestPersistence: vi.fn(async () => false),
    listProjects: vi.fn(async () => ({ ok: true as const, value: [] })),
    deleteProjects: vi.fn(),
  }) as unknown as SettingsStore;

function show(section: SettingsSection) {
  render(
    <AppBackendsProvider backends={{ createImageGenerator: vi.fn(), createPromptEnhancer: vi.fn(), vaultStorage: createMemoryVaultStorage(), kdfIterations: 1000, appId: 'material-lab' }}>
      <MaterialSettingsView store={store()} section={section} projectImport={idleImport} />
    </AppBackendsProvider>,
  );
}

describe('materialgen/app settings view', () => {
  it('R40 the navigation lists API keys, Models, Viewport, Shortcuts and Storage in that order, linking to the five sections', () => {
    show('keys');
    const links = within(screen.getByRole('navigation', { name: 'Settings sections' })).getAllByRole('link');
    expect(links.map((link) => link.textContent)).toEqual(['API keys', 'Models', 'Viewport', 'Shortcuts', 'Storage']);
    expect(links.map((link) => link.getAttribute('href'))).toEqual(['#/settings/keys', '#/settings/models', '#/settings/viewport', '#/settings/shortcuts', '#/settings/storage']);
  });

  it('R41 the API keys section no longer carries the "own key vault" line (settings R20)', () => {
    show('keys');
    expect(screen.queryByText(/own key vault/i)).toBeNull();
  });

  it('R42 the Models section is the shared one: enhancer model, the two image sizes and the model list refresh', async () => {
    show('models');
    expect(await screen.findByRole('combobox', { name: 'Prompt enhancer model' })).toBeTruthy();
    expect(screen.getByRole('combobox', { name: 'Max image size for enhancer' })).toBeTruthy();
    expect(screen.getByRole('combobox', { name: 'Reference image size' })).toBeTruthy();
    expect(screen.getByText('Model list')).toBeTruthy();
  });

  it('R42 the app names a model id only in the preset defaults and the price table', () => {
    const allowed = new Set(['generation/plan/presetPlans.ts', 'generation/cost/estimateImageCost.ts']);
    const root = path.resolve(__dirname, '../../../../src/materialgen');
    const offenders: string[] = [];
    const visit = (dir: string): void => {
      for (const entry of readdirSync(dir, { withFileTypes: true })) {
        const full = path.join(dir, entry.name);
        if (entry.isDirectory()) visit(full);
        else if (/\.tsx?$/.test(entry.name) && /['"`](gpt-|gemini-)[a-z0-9.-]+['"`]/.test(readFileSync(full, 'utf8')) && !allowed.has(path.relative(root, full).replaceAll('\\', '/'))) offenders.push(path.relative(root, full));
      }
    };
    visit(root);
    expect(offenders).toEqual([]);
  });

  it('R43 the Viewport section offers the shared controls and the app-wide preview prefs, but not the per-project Height and Tiling', async () => {
    show('viewport');
    expect(await screen.findByRole('heading', { name: 'Occlusion' })).toBeTruthy();
    expect(screen.getByRole('heading', { name: 'Mesh' })).toBeTruthy();
    expect(screen.queryByRole('heading', { name: 'Tiling' })).toBeNull();
    expect(screen.queryByRole('heading', { name: 'Height' })).toBeNull();
    expect(screen.getByRole('button', { name: 'Reset to defaults' })).toBeTruthy();
  });

  it('R43 Reset to defaults in Settings also puts back the app-wide preview prefs', async () => {
    const saved = store();
    saved.loadAppSettings = vi.fn(async () => ({ ...DEFAULT_APP_SETTINGS, previewPrefs: { mesh: 'plane', meshResolution: 3, aoIntensity: 1.5, maskOverlayOpacity: 0.2 } }));
    render(
      <AppBackendsProvider backends={{ createImageGenerator: vi.fn(), createPromptEnhancer: vi.fn(), vaultStorage: createMemoryVaultStorage(), kdfIterations: 1000, appId: 'material-lab' }}>
        <MaterialSettingsView store={saved} section="viewport" projectImport={idleImport} />
      </AppBackendsProvider>,
    );
    const occlusion = async () => within(await screen.findByRole('group', { name: 'Occlusion' })).getByRole('slider', { name: 'Intensity' }) as HTMLInputElement;
    await waitFor(async () => expect(Number((await occlusion()).value)).toBe(1.5));
    fireEvent.click(screen.getByRole('button', { name: 'Reset to defaults' }));
    await waitFor(async () => expect(Number((await occlusion()).value)).toBe(1));
  });

  it('R44 the Shortcuts section is the one generated from the shortcut table', () => {
    show('shortcuts');
    expect(screen.getByRole('heading', { name: 'Dialogs and overlays' })).toBeTruthy();
  });

  it('R45 the Storage section has Delete all data and no "Other apps" note (settings R20)', async () => {
    show('storage');
    expect(await screen.findByRole('button', { name: /Delete all data/ })).toBeTruthy();
    expect(screen.queryByText('Other apps')).toBeNull();
    expect(screen.queryByText(/separate from the projection app/i)).toBeNull();
  });

  it('storage-backends R10 in the desktop app the Storage section shows the library folder and Delete all data names the library, not the browser', async () => {
    expect(DESKTOP_DELETE_ALL_TEXT).not.toMatch(/browser/i);
    expect(DESKTOP_DELETE_ALL_TEXT).toContain('library folder');
    render(
      <AppBackendsProvider
        backends={{
          createImageGenerator: vi.fn(),
          createPromptEnhancer: vi.fn(),
          vaultStorage: createMemoryVaultStorage(),
          kdfIterations: 1000,
          appId: 'material-lab',
          location: { path: 'D:\\Materials', showInFolder: vi.fn(), change: vi.fn() },
        }}
      >
        <MaterialSettingsView store={store()} section="storage" projectImport={idleImport} />
      </AppBackendsProvider>,
    );
    expect(await screen.findByRole('group', { name: 'Library folder' })).toBeTruthy();
    expect(screen.getByText('D:\\Materials')).toBeTruthy();
  });
});
