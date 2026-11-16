import { describe, expect, it } from 'vitest';
import { createLauncherEnvKeySource } from '../../../src/shell/backends/launcherEnvKeySource';

function answering(status: number, body: unknown, seen: { url?: string; headers?: HeadersInit }[] = []): typeof fetch {
  return (async (input: RequestInfo | URL, init?: RequestInit) => {
    seen.push({ url: String(input), ...(init?.headers === undefined ? {} : { headers: init.headers }) });
    return new Response(typeof body === 'string' ? body : JSON.stringify(body), { status });
  }) as typeof fetch;
}

describe('createLauncherEnvKeySource (api-keys R21 b, R14, R16)', () => {
  it('TestR14_it_is_available_only_when_the_probe_answers_env_true', async () => {
    expect(await createLauncherEnvKeySource(answering(200, { env: true })).available()).toBe(true);
    expect(await createLauncherEnvKeySource(answering(200, '<!doctype html>')).available()).toBe(false); // the hosted site's index page
    expect(await createLauncherEnvKeySource(answering(404, '')).available()).toBe(false);
    expect(await createLauncherEnvKeySource((async () => { throw new Error('offline'); }) as typeof fetch).available()).toBe(false);
  });

  it('TestR21_read_asks_for_the_name_with_the_marker_header_and_returns_the_value', async () => {
    const seen: { url?: string; headers?: HeadersInit }[] = [];
    const reply = await createLauncherEnvKeySource(answering(200, { value: 'sk-abc' }, seen)).read('OPEN_AI_KEY');
    expect(reply).toEqual({ ok: true, value: 'sk-abc' });
    expect(seen[0]?.url).toBe('/__env/OPEN_AI_KEY');
    expect(seen[0]?.headers).toEqual({ 'X-Env-Read': '1' });
  });

  it('TestR21_a_404_is_not_set_and_other_failures_are_unavailable', async () => {
    expect(await createLauncherEnvKeySource(answering(404, '')).read('X_KEY')).toEqual({ ok: false, reason: 'not-set' });
    expect(await createLauncherEnvKeySource(answering(403, '')).read('X_KEY')).toEqual({ ok: false, reason: 'unavailable' });
    expect(await createLauncherEnvKeySource(answering(200, 'not json')).read('X_KEY')).toEqual({ ok: false, reason: 'unavailable' });
  });

  it('TestR16_the_launcher_needs_no_restart', () => {
    expect(createLauncherEnvKeySource(answering(200, {})).needsRestart).toBe(false);
  });
});
