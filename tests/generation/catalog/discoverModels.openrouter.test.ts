import { describe, expect, it, vi } from 'vitest';
import { discoverModels } from '../../../src/generation/catalog/discoverModels';
import type { OpenRouterModelPlugin } from '../../../src/generation/providers/openrouter/openrouterModelPlugin';
import { OPENROUTER_MODELS } from '../../../src/generation/providers/openrouter/registry';

const KEY = 'or-test-key-98765';
const signal = new AbortController().signal;
const json = (status: number, body: unknown): Response => new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });
const fetchOf = (answer: Response) => vi.fn(async () => answer.clone());
const discover = (fetchImpl: ReturnType<typeof fetchOf>, openRouterPlugins?: readonly OpenRouterModelPlugin[]) =>
  discoverModels('openrouter', KEY, signal, { fetchImpl: fetchImpl as unknown as typeof fetch, today: '2026-11-18', ...(openRouterPlugins ? { openRouterPlugins } : {}) });

describe('discoverModels: OpenRouter (R48)', () => {
  it('R48 checks the key with GET /api/v1/key and the Bearer header, then returns exactly the registered plug-ins as verified image models', async () => {
    const fetchImpl = fetchOf(json(200, { data: { label: 'k', usage: 0 } }));
    const result = await discover(fetchImpl);
    const [url, init] = fetchImpl.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe('https://openrouter.ai/api/v1/key');
    expect(init.method).toBe('GET');
    expect((init.headers as Record<string, string>)['Authorization']).toBe(`Bearer ${KEY}`);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.map((model) => model.id).sort()).toEqual(OPENROUTER_MODELS.map((plugin) => plugin.row.id).sort());
    for (const model of result.value) {
      expect(model).toMatchObject({ provider: 'openrouter', role: 'image', verified: true });
      expect(model).not.toHaveProperty('verifiedAt');
      expect(model).not.toHaveProperty('source');
    }
  });

  it('R48 a rejected key is auth and returns no models', async () => {
    const result = await discover(fetchOf(json(401, { error: { message: 'No auth credentials found' } })));
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.category).toBe('auth');
  });

  it('R44 with one plug-in removed from the list, that model is not offered and nothing else changes', async () => {
    const [removed, ...kept] = OPENROUTER_MODELS;
    expect(removed).toBeDefined();
    const result = await discover(fetchOf(json(200, {})), kept);
    expect(result.ok && result.value.map((model) => model.id).sort()).toEqual(kept.map((plugin) => plugin.row.id).sort());
  });

  it('R48 models that OpenRouter lists but no plug-in covers are never offered', async () => {
    const result = await discover(fetchOf(json(200, { data: [{ id: 'vendor/unknown-image-model' }] })), []);
    expect(result).toEqual({ ok: true, value: [] });
  });
});
