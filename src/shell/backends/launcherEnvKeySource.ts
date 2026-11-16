import type { EnvKeySource } from '../../keys';

const READ_HEADERS = { 'X-Env-Read': '1' };

/**
 * Api-keys R21 (b): the offline launcher's environment reader, `GET /__env/<name>` on the page's own address. The launcher reads the variable fresh at each
 * request, so one set while the app runs is found without a restart (R16). The hosted site has no such address (it answers its index page, not JSON),
 * so `available()` is false there and the switch is not offered (R14).
 */
export function createLauncherEnvKeySource(fetchPage: typeof fetch = (input, init) => fetch(input, init)): EnvKeySource {
  return {
    needsRestart: false,
    async available() {
      try {
        const reply = await fetchPage('/__env/', { headers: READ_HEADERS, cache: 'no-store' });
        const body: unknown = reply.ok ? await reply.json() : null;
        return typeof body === 'object' && body !== null && (body as { env?: unknown }).env === true;
      } catch {
        return false;
      }
    },
    async read(name, signal) {
      try {
        const reply = await fetchPage(`/__env/${encodeURIComponent(name)}`, { headers: READ_HEADERS, cache: 'no-store', ...(signal === undefined ? {} : { signal }) });
        if (reply.status === 404) return { ok: false, reason: 'not-set' };
        const body: unknown = reply.ok ? await reply.json() : null;
        const value = typeof body === 'object' && body !== null ? (body as { value?: unknown }).value : undefined;
        return typeof value === 'string' && value.trim() !== '' ? { ok: true, value } : { ok: false, reason: 'unavailable' };
      } catch {
        return { ok: false, reason: 'unavailable' };
      }
    },
  };
}
