import { describe, expect, it, vi } from 'vitest';
import { findSettingsBackHash } from '../../../src/shell/settings/findSettingsBackHash';
import { DEFAULT_APP_SETTINGS, type AppSettingsRecord } from '../../../src/projects/records/appSettingsRecord';
import { storeFailure } from '../../../src/projects/storeError';

const store = (settings: Partial<AppSettingsRecord> | 'unreadable', loadProject = vi.fn(async () => ({ ok: true as const, value: {} as never }))) => ({
  loadAppSettings: vi.fn(async () => {
    if (settings === 'unreadable') throw new Error('broken');
    return { ...DEFAULT_APP_SETTINGS, ...settings };
  }),
  saveAppSettings: vi.fn(async () => ({ ok: true as const, value: undefined })),
  loadProject,
});

describe('findSettingsBackHash', () => {
  it('settings R2 Back goes to the remembered project', async () => {
    expect(await findSettingsBackHash(store({ lastOpenProjectId: 'p1' }))).toBe('#/p/p1');
  });

  it('settings R2 Back goes to the list when no project is remembered', async () => {
    const s = store({ lastOpenProjectId: null });
    expect(await findSettingsBackHash(s)).toBe('#/projects');
    expect(s.loadProject).not.toHaveBeenCalled();
  });

  it('settings R2 Back goes to the list when the settings cannot be read', async () => {
    expect(await findSettingsBackHash(store('unreadable'))).toBe('#/projects');
  });

  it('settings R2 Back goes to the list and forgets a project that no longer exists', async () => {
    const s = store({ lastOpenProjectId: 'gone' }, vi.fn(async () => storeFailure('not-found', 'gone') as never));
    expect(await findSettingsBackHash(s)).toBe('#/projects');
    expect(s.saveAppSettings).toHaveBeenCalledWith({ lastOpenProjectId: null });
  });

  it('settings R2 a project that is only unreadable is still the Back target, so its view can say why', async () => {
    const s = store({ lastOpenProjectId: 'bad' }, vi.fn(async () => storeFailure('corrupt', 'damaged') as never));
    expect(await findSettingsBackHash(s)).toBe('#/p/bad');
    expect(s.saveAppSettings).not.toHaveBeenCalled();
  });
});
