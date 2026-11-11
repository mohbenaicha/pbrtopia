import 'fake-indexeddb/auto';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { createBrowserBackends } from '../../../src/shell/backends/createBrowserBackends';
import { sampleVaultRecord } from '../../keys/vaultFixtures';

afterEach(() => vi.unstubAllGlobals());

// Calls the real adapter with a fetch that only records where the request went.
async function hostOfImageRequest(provider: 'gemini' | 'openai'): Promise<string> {
  const urls: string[] = [];
  vi.stubGlobal('fetch', async (input: RequestInfo | URL) => {
    urls.push(String(input));
    return new Response('{}', { status: 401 });
  });
  const model = provider === 'gemini' ? 'gemini-nano-banana-2.1' : 'gpt-image-2.5-sunburst';
  await createBrowserBackends()
    .createImageGenerator(provider)
    .generate({ model, prompt: 'a stone', images: [new Blob(['x'], { type: 'image/png' })], references: [], resolutionKey: '1K', sizePx: 1024, quality: null }, { apiKey: 'test-key', signal: AbortSignal.timeout(5_000) });
  return new URL(urls[0]!).host;
}

describe('createBrowserBackends', () => {
  it('generate R21 each provider gets its own image adapter, which calls that provider\'s host with the browser fetch', async () => {
    expect(await hostOfImageRequest('gemini')).toBe('generativelanguage.googleapis.com');
    expect(await hostOfImageRequest('openai')).toBe('api.openai.com');
  });

  it('generate R21 each provider gets its own prompt enhancer, which calls that provider\'s host', async () => {
    const hosts: string[] = [];
    vi.stubGlobal('fetch', async (input: RequestInfo | URL) => {
      hosts.push(new URL(String(input)).host);
      return new Response('{}', { status: 401 });
    });
    const backends = createBrowserBackends();
    const request = { model: 'm', instruction: 'describe', prompt: 'a stone', image: new Blob(['x'], { type: 'image/png' }) };
    for (const provider of ['gemini', 'openai'] as const) await backends.createPromptEnhancer(provider).enhance(request as never, { apiKey: 'test-key', signal: AbortSignal.timeout(5_000) });
    expect(hosts).toEqual(['generativelanguage.googleapis.com', 'api.openai.com']);
  });

  it('generate R21 the vault storage is the browser\'s IndexedDB: a record saved through one backend set is loaded by a new one', async () => {
    const first = createBrowserBackends();
    expect(await first.vaultStorage.load()).toBeNull();
    expect(await first.vaultStorage.save(sampleVaultRecord({ revision: 1 }), null)).toBe('saved');
    expect(await createBrowserBackends().vaultStorage.load()).toEqual(sampleVaultRecord({ revision: 1 }));
  });
});
