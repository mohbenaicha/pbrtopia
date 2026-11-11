import { describe, expect, it, vi } from 'vitest';
import { createRouter, listHash, projectHash } from '../../../src/shell/routing/router';
import { decideStartup, type StartupStore } from '../../../src/shell/routing/startup';

const router = createRouter(['keys', 'models', 'storage'] as const);

describe('shared/materialgen-prep R53 createRouter', () => {
  it('R53 names a settings address by the app-given section', () => {
    expect(router.settingsHash('models')).toBe('#/settings/models');
    expect(listHash()).toBe('#/projects');
    expect(projectHash('a b')).toBe('#/p/a%20b');
  });

  it('R53 reads the three views and falls back to the first given section, not a projection one', () => {
    expect(router.parseHash('#/projects')).toEqual({ view: 'list' });
    expect(router.parseHash('#/p/id-1')).toEqual({ view: 'project', id: 'id-1' });
    expect(router.parseHash('#/settings/storage')).toEqual({ view: 'settings', section: 'storage' });
    expect(router.parseHash('#/settings/nonsense')).toEqual({ view: 'settings', section: 'keys' });
    expect(router.parseHash('#/settings')).toEqual({ view: 'settings', section: 'keys' });
    expect(router.parseHash('#/settings/api-keys')).toEqual({ view: 'settings', section: 'keys' }); // a section of another app is not known here
  });

  it('R53 classifies addresses and calls an unusable one unknown', () => {
    expect(router.classifyAddress('')).toBe('start');
    expect(router.classifyAddress('#/projects')).toBe('list');
    expect(router.classifyAddress('#/p/id-1')).toBe('project');
    expect(router.classifyAddress('#/settings/keys')).toBe('settings');
    expect(router.classifyAddress('#/elsewhere')).toBe('unknown');
    expect(router.classifyAddress('#/p/%E0%A4%A')).toBe('unknown');
  });

  it('R53 reports route changes by the app sections and stops when told', () => {
    const listeners: Array<() => void> = [];
    const target = {
      location: { hash: '#/settings/models' },
      addEventListener: (_: string, listener: () => void) => listeners.push(listener),
      removeEventListener: vi.fn(),
    } as unknown as Pick<Window, 'location' | 'addEventListener' | 'removeEventListener'>;
    const seen: unknown[] = [];
    const stop = router.watchRoute(target, (route) => seen.push(route));
    listeners[0]?.();
    expect(seen).toEqual([{ view: 'settings', section: 'models' }]);
    stop();
    expect(target.removeEventListener).toHaveBeenCalledWith('hashchange', listeners[0]);
  });
});

describe('shared/materialgen-prep R53 decideStartup with an app router', () => {
  const store = (lastOpenProjectId: string | null): StartupStore =>
    ({
      loadAppSettings: async () => ({ lastOpenProjectId }),
      saveAppSettings: async () => ({ ok: true, value: undefined }),
      loadProject: async () => ({ ok: true, value: {} }),
    }) as unknown as StartupStore;

  it('R53 keeps a settings address of the app and rewrites an unknown one to the list', async () => {
    expect(await decideStartup('#/settings/storage', store(null), router)).toEqual({ route: { view: 'settings', section: 'storage' }, replaceHash: null, notice: null });
    expect(await decideStartup('#/nowhere', store(null), router)).toEqual({ route: { view: 'list' }, replaceHash: '#/projects', notice: 'address-unknown' });
  });

  it('R53 the bare address reopens the last open project', async () => {
    expect(await decideStartup('', store('p1'), router)).toEqual({ route: { view: 'project', id: 'p1' }, replaceHash: '#/p/p1', notice: null });
  });
});
