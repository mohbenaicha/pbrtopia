import { readFileSync } from 'node:fs';
import { describe, expect, it, vi } from 'vitest';
import { findKnownModel, KNOWN_MODELS } from '../../../../src/generation/catalog/knownModels';
import type { GenerateRequest } from '../../../../src/generation/providers/ImageGenerator';
import { buildOpenRouterBody, OPENROUTER_IMAGES_URL } from '../../../../src/generation/providers/openrouter/openrouterRequests';
import { createOpenRouterImageGenerator } from '../../../../src/generation/providers/openrouter/openrouterImageGenerator';
import type { OpenRouterModelPlugin } from '../../../../src/generation/providers/openrouter/openrouterModelPlugin';
import { parseOpenRouterImage } from '../../../../src/generation/providers/openrouter/openrouterResponses';
import { OPENROUTER_MODELS } from '../../../../src/generation/providers/openrouter/registry';

const KEY = 'or-test-key-0123456789';
const png = (text = 'atlas'): Blob => new Blob([text], { type: 'image/png' });
const ctx = { apiKey: KEY, signal: new AbortController().signal };
const reply = (body: unknown, status = 200): Response => new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });

// A stand-in plug-in: these tests do not depend on any real model, so removing a model never breaks them (R44).
const fake: OpenRouterModelPlugin = {
  row: { provider: 'openrouter', id: 'vendor/fake-model', role: 'image', displayName: 'Fake', verified: true, resolutions: [{ key: '1K', sizePx: 1024 }, { key: '2K', sizePx: 2048 }], qualityLevels: [], maxReferenceImages: 4, verifiedAt: '2026-11-18', source: ['test'] },
  wire: { resolutionValues: { '1K': '1K', '2K': '2K' }, ratios: [[1, 1], [4, 3], [3, 4], [16, 9]] },
};
const noResolutionField: OpenRouterModelPlugin = { ...fake, wire: { ...fake.wire, resolutionValues: {} } };
const request = (patch: Partial<GenerateRequest> = {}): GenerateRequest => ({ model: fake.row.id, prompt: 'weathered steel', images: [png()], references: [], resolutionKey: '1K', sizePx: 1024, quality: null, ...patch });

function fakeFetch(response: Response) {
  const calls: { url: string; init: RequestInit }[] = [];
  const fetchImpl = vi.fn(async (url: string | URL | Request, init?: RequestInit) => {
    calls.push({ url: String(url), init: init ?? {} });
    return response.clone();
  });
  return { fetchImpl: fetchImpl as unknown as typeof fetch, calls };
}
const image = (base64 = 'SGk=') => ({ mimeType: 'image/png', base64 });

describe('buildOpenRouterBody (R45)', () => {
  it('R45 a text request holds the model, prompt, resolution and a square aspect ratio, and nothing else', () => {
    const body = buildOpenRouterBody({ prompt: 'p', resolutionKey: '2K', images: [] }, fake);
    expect(body).toEqual({ ok: true, value: { model: 'vendor/fake-model', prompt: 'p', resolution: '2K', aspect_ratio: '1:1' } });
  });

  it('R45 pictures go under input_references as data URLs in order, and no quality, seed, n, output_format or background is sent', () => {
    const body = buildOpenRouterBody({ prompt: 'p', resolutionKey: '1K', images: [image('AAA='), { mimeType: 'image/jpeg', base64: 'BBB=' }] }, fake);
    expect(body.ok).toBe(true);
    if (!body.ok) return;
    expect(body.value['input_references']).toEqual([
      { type: 'image_url', image_url: { url: 'data:image/png;base64,AAA=' } },
      { type: 'image_url', image_url: { url: 'data:image/jpeg;base64,BBB=' } },
    ]);
    for (const field of ['quality', 'seed', 'n', 'output_format', 'background']) expect(body.value).not.toHaveProperty(field);
  });

  it('R45 a canvas gives its own ratio; a ratio the plug-in does not list is refused as bad-request', () => {
    const wide = buildOpenRouterBody({ prompt: 'p', resolutionKey: '1K', images: [], canvas: { width: 1024, height: 768 } }, fake);
    expect(wide.ok && wide.value['aspect_ratio']).toBe('4:3');
    const ultra = buildOpenRouterBody({ prompt: 'p', resolutionKey: '1K', images: [], canvas: { width: 2100, height: 900 } }, fake);
    expect(ultra.ok).toBe(false);
    if (!ultra.ok) expect(ultra.error.category).toBe('bad-request');
  });

  it('R45 a resolution key the plug-in does not offer is refused as bad-request', () => {
    const refused = buildOpenRouterBody({ prompt: 'p', resolutionKey: '4K', images: [] }, fake);
    expect(refused.ok).toBe(false);
    if (!refused.ok) expect(refused.error.category).toBe('bad-request');
  });

  it('R45 a plug-in with no resolution field sends none', () => {
    const body = buildOpenRouterBody({ prompt: 'p', resolutionKey: '1K', images: [] }, noResolutionField);
    expect(body.ok && body.value).toEqual({ model: 'vendor/fake-model', prompt: 'p', aspect_ratio: '1:1' });
  });
});

describe('parseOpenRouterImage (R46)', () => {
  it('R46 reads data[0].b64_json, its media type and the cost', () => {
    expect(parseOpenRouterImage({ data: [{ b64_json: 'SGk=', media_type: 'image/jpeg' }], usage: { cost: 0.048 } })).toEqual({ ok: true, value: { base64: 'SGk=', mimeType: 'image/jpeg', costUsd: 0.048 } });
  });

  it('R46 a missing media type is png and a missing or non-numeric cost leaves costUsd out', () => {
    const parsed = parseOpenRouterImage({ data: [{ b64_json: 'SGk=' }], usage: { cost: 'free' } });
    expect(parsed).toEqual({ ok: true, value: { base64: 'SGk=', mimeType: 'image/png' } });
  });

  it('R46 an empty or missing image is a retryable server error', () => {
    for (const body of [{ data: [] }, { data: [{ b64_json: '' }] }, {}, null]) {
      const parsed = parseOpenRouterImage(body);
      expect(parsed.ok).toBe(false);
      if (!parsed.ok) expect(parsed.error).toMatchObject({ category: 'server', retryable: true });
    }
  });
});

describe('createOpenRouterImageGenerator (R45, R46, R49)', () => {
  it('R45 posts one JSON request to the images endpoint with the key only in the Authorization header (R14)', async () => {
    const { fetchImpl, calls } = fakeFetch(reply({ data: [{ b64_json: 'SGk=', media_type: 'image/png' }], usage: { cost: 0.03 } }));
    const result = await createOpenRouterImageGenerator(fetchImpl, [fake]).generate(request({ references: [png('ref')] }), ctx);
    expect(calls).toHaveLength(1);
    expect(calls[0]?.url).toBe(OPENROUTER_IMAGES_URL);
    expect(calls[0]?.url).toBe('https://openrouter.ai/api/v1/images');
    expect(calls[0]?.url).not.toContain(KEY);
    const headers = calls[0]?.init.headers as Record<string, string>;
    expect(headers['Authorization']).toBe(`Bearer ${KEY}`);
    expect(headers['content-type']).toBe('application/json');
    const sent = JSON.parse(String(calls[0]?.init.body)) as Record<string, unknown>;
    expect(sent['model']).toBe('vendor/fake-model');
    expect(sent['input_references']).toHaveLength(2);
    expect(result.ok && result.value.mimeType).toBe('image/png');
    expect(result.ok && result.value.costUsd).toBe(0.03);
  });

  it('R46 an answer without a cost returns no costUsd', async () => {
    const { fetchImpl } = fakeFetch(reply({ data: [{ b64_json: 'SGk=' }] }));
    const result = await createOpenRouterImageGenerator(fetchImpl, [fake]).generate(request(), ctx);
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.value).not.toHaveProperty('costUsd');
  });

  it('R45 nothing is sent for a model no plug-in covers, for an empty request or for a refused size', async () => {
    const { fetchImpl, calls } = fakeFetch(reply({ data: [{ b64_json: 'SGk=' }] }));
    const generator = createOpenRouterImageGenerator(fetchImpl, [fake]);
    const unknown = await generator.generate(request({ model: 'vendor/other' }), ctx);
    const empty = await generator.generate(request({ prompt: ' ', images: [] }), ctx);
    const size = await generator.generate(request({ resolutionKey: '4K', sizePx: 4096 }), ctx);
    for (const refused of [unknown, empty, size]) expect(!refused.ok && refused.error.category).toBe('bad-request');
    expect(calls).toHaveLength(0);
  });

  it('R44 a generator built without a plug-in cannot call its model (unplugged)', async () => {
    const { fetchImpl, calls } = fakeFetch(reply({ data: [{ b64_json: 'SGk=' }] }));
    const result = await createOpenRouterImageGenerator(fetchImpl, []).generate(request(), ctx);
    expect(!result.ok && result.error.category).toBe('bad-request');
    expect(calls).toHaveLength(0);
  });

  it('R49 a 402 is quota and a 502 is a retryable server error', async () => {
    const quota = await createOpenRouterImageGenerator(fakeFetch(reply({ error: { message: 'Insufficient credits' } }, 402)).fetchImpl, [fake]).generate(request(), ctx);
    expect(!quota.ok && quota.error.category).toBe('quota');
    const server = await createOpenRouterImageGenerator(fakeFetch(reply({ error: { message: 'Provider returned error' } }, 502)).fetchImpl, [fake]).generate(request(), ctx);
    expect(!server.ok && server.error).toMatchObject({ category: 'server', retryable: true });
  });
});

describe('the registered OpenRouter plug-ins (R44, R47)', () => {
  it('R44 every plug-in row is in the shipped table, is an OpenRouter image model, and ids are unique', () => {
    expect(OPENROUTER_MODELS.length).toBeGreaterThan(0);
    for (const plugin of OPENROUTER_MODELS) {
      expect(plugin.row.provider, plugin.row.id).toBe('openrouter');
      expect(plugin.row.role, plugin.row.id).toBe('image');
      expect(findKnownModel('openrouter', plugin.row.id), plugin.row.id).not.toBeNull();
    }
    const ids = OPENROUTER_MODELS.map((plugin) => plugin.row.id);
    expect(new Set(ids).size).toBe(ids.length);
    expect(KNOWN_MODELS.filter((entry) => entry.provider === 'openrouter').map((entry) => entry.id).sort()).toEqual([...ids].sort());
  });

  it('R47 sizes are 1K, 2K or 4K only, each with a resolution value (or 1K alone when the plug-in sends none), no quality levels, and a reference limit', () => {
    for (const plugin of OPENROUTER_MODELS) {
      const keys = plugin.row.resolutions.map((option) => option.key);
      expect(keys.length, plugin.row.id).toBeGreaterThan(0);
      for (const key of keys) expect(['1K', '2K', '4K'], plugin.row.id).toContain(key);
      const values = Object.keys(plugin.wire.resolutionValues);
      if (values.length === 0) expect(keys, plugin.row.id).toEqual(['1K']);
      else for (const key of keys) expect(values, plugin.row.id).toContain(key);
      expect(plugin.row.qualityLevels, plugin.row.id).toEqual([]);
      expect(plugin.row.maxReferenceImages, plugin.row.id).toBeGreaterThanOrEqual(1);
    }
  });

  it('R45 every canvas a plug-in offers has a ratio the plug-in lists, so no offered canvas is refused', () => {
    for (const plugin of OPENROUTER_MODELS) {
      for (const key of plugin.row.resolutions.map((option) => option.key)) {
        for (const canvas of plugin.row.canvases?.byResolution[key] ? (plugin.row.canvases.kind === 'list' ? plugin.row.canvases.byResolution[key] ?? [] : []) : []) {
          const body = buildOpenRouterBody({ prompt: 'p', resolutionKey: key, images: [], canvas }, plugin);
          expect(body.ok, `${plugin.row.id} ${key} ${canvas.width}x${canvas.height}`).toBe(true);
        }
      }
    }
  });
});

describe('desktop network allowance (R49)', () => {
  it('R49 connect-src allows https://openrouter.ai', () => {
    const config = JSON.parse(readFileSync('src-tauri/tauri.conf.json', 'utf8')) as { app: { security: { csp: string } } };
    expect(config.app.security.csp).toMatch(/connect-src[^;]*https:\/\/openrouter\.ai/);
  });
});
