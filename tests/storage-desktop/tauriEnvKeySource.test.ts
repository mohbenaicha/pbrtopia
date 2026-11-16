import { describe, expect, it } from 'vitest';
import { createTauriEnvKeySource } from '../../src/storage-desktop/tauri/tauriEnvKeySource';

describe('createTauriEnvKeySource (api-keys R21 a, R16)', () => {
  it('TestR21_read_calls_env_read_with_the_name_and_returns_the_value', async () => {
    const calls: unknown[][] = [];
    const source = createTauriEnvKeySource(async (command, args) => {
      calls.push([command, args]);
      return 'sk-abc';
    });
    expect(await source.read('GEMINI_API_KEY')).toEqual({ ok: true, value: 'sk-abc' });
    expect(calls).toEqual([['env_read', { name: 'GEMINI_API_KEY' }]]);
    expect(await source.available()).toBe(true);
  });

  it('TestR21_none_is_not_set_and_a_refusal_is_unavailable', async () => {
    expect(await createTauriEnvKeySource(async () => null).read('X_KEY')).toEqual({ ok: false, reason: 'not-set' });
    expect(await createTauriEnvKeySource(async () => { throw new Error('refused'); }).read('X_KEY')).toEqual({ ok: false, reason: 'unavailable' });
  });

  it('TestR16_the_desktop_app_needs_a_restart_for_a_variable_set_later', () => {
    expect(createTauriEnvKeySource(async () => null).needsRestart).toBe(true);
  });
});
