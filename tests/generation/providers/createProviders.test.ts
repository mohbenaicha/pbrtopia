import { describe, expect, it, vi } from 'vitest';
import { createImageGenerator, createPromptEnhancer } from '../../../src/generation/providers/createProviders';

const ctx = { apiKey: 'k-0123456789', signal: new AbortController().signal };
const atlas = new Blob(['a'], { type: 'image/png' });

describe('createProviders (R7, R8)', () => {
  it('R7 the image generator of each provider calls that provider\'s host', async () => {
    for (const [provider, host] of [['gemini', 'generativelanguage.googleapis.com'], ['openai', 'api.openai.com']] as const) {
      const fetchImpl = vi.fn(async () => new Response('{}', { status: 200 })) as unknown as typeof fetch;
      await createImageGenerator(provider, fetchImpl).generate({ model: 'm', prompt: 'p', images: [atlas], references: [], resolutionKey: '1K', sizePx: 1024, quality: null }, ctx);
      expect(String((fetchImpl as unknown as ReturnType<typeof vi.fn>).mock.calls[0]?.[0])).toContain(host);
    }
  });

  it('R8 the prompt enhancer of each provider calls that provider\'s host', async () => {
    for (const [provider, host] of [['gemini', 'generativelanguage.googleapis.com'], ['openai', 'api.openai.com']] as const) {
      const fetchImpl = vi.fn(async () => new Response('{}', { status: 200 })) as unknown as typeof fetch;
      await createPromptEnhancer(provider, fetchImpl).enhance({ model: 'm', prompt: 'p', image: atlas, level: null }, ctx);
      expect(String((fetchImpl as unknown as ReturnType<typeof vi.fn>).mock.calls[0]?.[0])).toContain(host);
    }
  });
});
