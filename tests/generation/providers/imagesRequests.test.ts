import { describe, expect, it, vi } from 'vitest';
import type { GenerateRequest } from '../../../src/generation/providers/ImageGenerator';
import { createGeminiImageGenerator } from '../../../src/generation/providers/gemini/geminiImageGenerator';
import { createOpenAiImageGenerator } from '../../../src/generation/providers/openai/openaiImageGenerator';

const ctx = { apiKey: 'test-key-0123456789', signal: new AbortController().signal };
const png = (text: string, size = 0): Blob => new Blob([size > 0 ? new Uint8Array(size) : text], { type: 'image/png' });
const geminiOk = { status: 'completed', steps: [{ type: 'model_output', content: [{ type: 'image', mime_type: 'image/jpeg', data: 'SGk=' }] }] };
const openAiOk = { data: [{ b64_json: 'SGk=' }] };

function fakeFetch(body: unknown) {
  const calls: { url: string; init: RequestInit }[] = [];
  const fetchImpl = vi.fn(async (url: string | URL | Request, init?: RequestInit) => {
    calls.push({ url: String(url), init: init ?? {} });
    return new Response(JSON.stringify(body), { status: 200, headers: { 'content-type': 'application/json' } });
  });
  return { fetchImpl: fetchImpl as unknown as typeof fetch, calls };
}

const gemini = (patch: Partial<GenerateRequest> = {}): GenerateRequest => ({ model: 'gemini-3.1-flash-image', prompt: 'weathered steel', images: [], references: [], resolutionKey: '1K', sizePx: 1024, quality: 'minimal', ...patch });
const openAi = (patch: Partial<GenerateRequest> = {}): GenerateRequest => ({ model: 'gpt-image-2.5-sunburst', prompt: 'weathered steel', images: [], references: [], resolutionKey: '1K', sizePx: 1024, quality: 'auto', ...patch });

const geminiParts = (calls: { init: RequestInit }[]): { type: string; text?: string; data?: string }[] => (JSON.parse(String(calls[0]?.init.body)) as { input: { type: string; text?: string; data?: string }[] }).input;

describe('shared/materialgen-prep R16 several images', () => {
  it('R16 Gemini sends every image in list order, then the references', async () => {
    const { fetchImpl, calls } = fakeFetch(geminiOk);
    await createGeminiImageGenerator(fetchImpl).generate(gemini({ images: [png('one'), png('two')], references: [png('ref')] }), ctx);
    const parts = geminiParts(calls);
    expect(parts.map((part) => part.type)).toEqual(['text', 'image', 'image', 'image']);
    expect(parts.slice(1).map((part) => atob(part.data ?? ''))).toEqual(['one', 'two', 'ref']);
  });

  it('R16 OpenAI sends every image in list order, then the references, under the one image field', async () => {
    const { fetchImpl, calls } = fakeFetch(openAiOk);
    await createOpenAiImageGenerator(fetchImpl).generate(openAi({ images: [png('one'), png('two')], references: [png('ref')] }), ctx);
    const files = (calls[0]?.init.body as FormData).getAll('image[]') as File[];
    expect(await Promise.all(files.map((file) => file.text()))).toEqual(['one', 'two', 'ref']);
  });
});

describe('shared/materialgen-prep R17 text-only requests', () => {
  it('R17 Gemini with no image and no reference sends a text-only body', async () => {
    const { fetchImpl, calls } = fakeFetch(geminiOk);
    const result = await createGeminiImageGenerator(fetchImpl).generate(gemini(), ctx);
    expect(result.ok).toBe(true);
    expect(geminiParts(calls)).toEqual([{ type: 'text', text: 'weathered steel' }]);
  });

  it('R17 Gemini with no image but references sends the references as the only images', async () => {
    const { fetchImpl, calls } = fakeFetch(geminiOk);
    await createGeminiImageGenerator(fetchImpl).generate(gemini({ references: [png('ref')] }), ctx);
    expect(geminiParts(calls).map((part) => part.type)).toEqual(['text', 'image']);
  });

  it('R17 OpenAI with no image and no reference uses the generations endpoint with a JSON body', async () => {
    const { fetchImpl, calls } = fakeFetch(openAiOk);
    const result = await createOpenAiImageGenerator(fetchImpl).generate(openAi({ resolutionKey: '2K', sizePx: 2048, quality: 'medium' }), ctx);
    expect(result.ok).toBe(true);
    expect(calls[0]?.url).toBe('https://api.openai.com/v1/images/generations');
    const headers = calls[0]?.init.headers as Record<string, string>;
    expect(headers['content-type']).toBe('application/json');
    expect(headers['Authorization']).toBe(`Bearer ${ctx.apiKey}`);
    expect(JSON.parse(String(calls[0]?.init.body))).toEqual({ model: 'gpt-image-2.5-sunburst', prompt: 'weathered steel', size: '2048x2048', quality: 'medium', output_format: 'png' });
  });

  it('R17 OpenAI generations carry complexity for a 2.6 model and leave quality out when the model has none', async () => {
    const { fetchImpl, calls } = fakeFetch(openAiOk);
    await createOpenAiImageGenerator(fetchImpl).generate(openAi({ model: 'gpt-image-2.6-sunburst', quality: null }), ctx);
    const body = JSON.parse(String(calls[0]?.init.body)) as Record<string, unknown>;
    expect(body['complexity']).toBe('medium');
    expect(body).not.toHaveProperty('quality');
  });

  it('R17 OpenAI with references but no image still uses the edits endpoint', async () => {
    const { fetchImpl, calls } = fakeFetch(openAiOk);
    await createOpenAiImageGenerator(fetchImpl).generate(openAi({ references: [png('ref')] }), ctx);
    expect(calls[0]?.url).toBe('https://api.openai.com/v1/images/edits');
  });

  it.each([
    ['Gemini', () => createGeminiImageGenerator, gemini],
    ['OpenAI', () => createOpenAiImageGenerator, openAi],
  ] as const)('R17 %s with no prompt text and no image returns bad-request and makes no network call', async (_name, factory, make) => {
    const { fetchImpl, calls } = fakeFetch({});
    const result = await factory()(fetchImpl).generate(make({ prompt: '   ' }), ctx);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.category).toBe('bad-request');
      expect(result.error.message).toBe('There is nothing to send: give a prompt or an image.');
    }
    expect(calls).toHaveLength(0);
  });
});

describe('shared/materialgen-prep R18 inline size counts every image', () => {
  it('R18 several large images that together pass the limit fail with the same message as one large image', async () => {
    const { fetchImpl, calls } = fakeFetch(geminiOk);
    const third = 7 * 1024 * 1024;
    const many = await createGeminiImageGenerator(fetchImpl).generate(gemini({ images: [png('', third), png('', third), png('', third)] }), ctx);
    const one = await createGeminiImageGenerator(fetchImpl).generate(gemini({ images: [png('', 16 * 1024 * 1024)] }), ctx);
    expect(many.ok).toBe(false);
    expect(one.ok).toBe(false);
    if (!many.ok && !one.ok) expect(many.error.message).toBe(one.error.message);
    expect(calls).toHaveLength(0);
  });
});
