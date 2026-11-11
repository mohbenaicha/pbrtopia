// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { DEFAULT_APP_SETTINGS } from '../../../src/projects/records/appSettingsRecord';
import type { ProjectImportState } from '../../../src/projects/ui/ImportProjectButton';
import { AppBackendsProvider } from '../../../src/shell/backends/AppBackendsProvider';
import { SettingsView, type SettingsSectionDef, type SettingsStore } from '../../../src/shell/settings/SettingsView';
import { createMemoryVaultStorage } from '../../keys/memoryVaultStorage';

afterEach(() => {
  cleanup();
  window.location.hash = '';
});

const idleImport: ProjectImportState = { importing: false, progress: null, message: null, error: null, start: vi.fn(async () => undefined) };
const store = (): SettingsStore =>
  ({
    loadAppSettings: vi.fn(async () => DEFAULT_APP_SETTINGS),
    saveAppSettings: vi.fn(async () => ({ ok: true as const, value: undefined })),
    loadProject: vi.fn(),
  }) as unknown as SettingsStore;

type Mine = 'keys' | 'extras';
const SECTIONS: SettingsSectionDef<Mine>[] = [
  { id: 'keys', label: 'My keys', render: () => <p>keys body</p> },
  { id: 'extras', label: 'Extras', render: (context) => <p>{`extras body, import idle: ${String(!context.projectImport.importing)}`}</p> },
];

function show(section: Mine) {
  render(
    <AppBackendsProvider backends={{ createImageGenerator: vi.fn(), createPromptEnhancer: vi.fn(), vaultStorage: createMemoryVaultStorage(), kdfIterations: 1000 }}>
      <SettingsView store={store()} sections={SECTIONS} section={section} settingsHash={(name) => `#/settings/${name}`} projectImport={idleImport} />
    </AppBackendsProvider>,
  );
}

describe('shared/materialgen-prep R53 SettingsView takes its sections as data', () => {
  it('R53 the navigation lists the given sections in the given order and marks the shown one', () => {
    show('extras');
    const links = within(screen.getByRole('navigation', { name: 'Settings sections' })).getAllByRole('link');
    expect(links.map((link) => link.textContent)).toEqual(['My keys', 'Extras']);
    expect(links.map((link) => link.getAttribute('href'))).toEqual(['#/settings/keys', '#/settings/extras']);
    expect(links.map((link) => link.getAttribute('aria-current'))).toEqual([null, 'page']);
  });

  it('R53 only the chosen section is drawn, with the shared context passed in', () => {
    show('extras');
    expect(screen.getByText('extras body, import idle: true')).toBeTruthy();
    expect(screen.queryByText('keys body')).toBeNull();
  });

  it('R53 Back goes to the project list when no project is remembered', async () => {
    show('keys');
    window.location.hash = '#/settings/keys';
    fireEvent.click(screen.getByRole('button', { name: 'Back' }));
    await waitFor(() => expect(window.location.hash).toBe('#/projects'));
  });
});
