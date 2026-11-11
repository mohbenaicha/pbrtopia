import { describe, expect, it } from 'vitest';
import { classifyAddress, parseHash, settingsHash, SETTINGS_SECTIONS } from '@mat/app/routes/router';

describe('materialgen/app routes', () => {
  it('R9 R40 the sections are keys, models, viewport, shortcuts, storage in that order', () => {
    expect([...SETTINGS_SECTIONS]).toEqual(['keys', 'models', 'viewport', 'shortcuts', 'storage']);
    expect(settingsHash('keys')).toBe('#/settings/keys');
  });

  it('R9 the four addresses are the start, the list, a project and a settings section', () => {
    expect(classifyAddress('')).toBe('start');
    expect(classifyAddress('#/projects')).toBe('list');
    expect(classifyAddress('#/p/abc')).toBe('project');
    expect(classifyAddress('#/settings/storage')).toBe('settings');
    expect(classifyAddress('#/nowhere')).toBe('unknown');
  });

  it('R9 an unnamed or unknown settings section is the first one, and an unusable address is the list', () => {
    expect(parseHash('#/settings')).toEqual({ view: 'settings', section: 'keys' });
    expect(parseHash('#/settings/api-keys')).toEqual({ view: 'settings', section: 'keys' });
    expect(parseHash('#/settings/shortcuts')).toEqual({ view: 'settings', section: 'shortcuts' });
    expect(parseHash('#/p/abc')).toEqual({ view: 'project', id: 'abc' });
    expect(parseHash('#/zzz')).toEqual({ view: 'list' });
  });
});
