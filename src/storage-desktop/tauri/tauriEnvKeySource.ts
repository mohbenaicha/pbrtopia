import type { EnvKeySource } from '../../keys';
import type { TauriInvoke } from './tauriInvoke';

/**
 * Api-keys R21 (a): the desktop app's environment reader, the `env_read` command. Rust answers the environment as the app was started with,
 * so a variable set afterwards needs a restart (R16). A name Rust refuses or a failed call reads as unavailable; the value is returned, never kept.
 */
export function createTauriEnvKeySource(invoke: TauriInvoke): EnvKeySource {
  return {
    needsRestart: true,
    available: async () => true,
    async read(name) {
      try {
        const value = await invoke('env_read', { name });
        return typeof value === 'string' && value.trim() !== '' ? { ok: true, value } : { ok: false, reason: 'not-set' };
      } catch {
        return { ok: false, reason: 'unavailable' };
      }
    },
  };
}
