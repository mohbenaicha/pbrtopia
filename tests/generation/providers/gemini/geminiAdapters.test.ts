import { describe, expect, it, vi } from 'vitest';
import type { GenerateRequest } from '../../../../src/generation/providers/ImageGenerator';
import { createGeminiImageGenerator } from '../../../../src/generation/providers/gemini/geminiImageGenerator';
import { createGeminiPromptEnhancer } from '../../../../src/generation/providers/gemini/geminiPromptEnhancer';

const KEY = 'AIza-test-key-0123456789';
const png = (bytes = 4): Blob => new Blob([new Uint8Array(bytes).fill(7)], { type: 'image/png' });
const ctx = (signal = new AbortController().signal) => ({ apiKey: KEY, signal });
const request = (patch: Partial<GenerateRequest> = {}): GenerateRequest => ({ model: 'gemini-3.1-flash-image', prompt: 'weathered steel', atlas: png(), references: [], resolutionKey: '1K', sizePx: 1024, quality: 'minimal', ...patch });
const answerWith = (content: unknown[]) => ({ status: 'completed', steps: [{ type: 'model_output', content }] });
const reply = (body: unknown, status = 200): Response => new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });

function fakeFetch(response: Response | (() => Promise<Response>)) {
  const calls: { url: string; init: RequestInit }[] = [];
  const fetchImpl = vi.fn(async (url: string | URL | Request, init?: RequestInit) => {
    calls.push({ url: String(url), init: init ?? {} });
    return typeof response === 'function' ? response() : response.clone();
  });
  return { fetchImpl: fetchImpl as unknown as typeof fetch, calls };
}

describe('createGeminiImageGenerator (R7, R14)', () => {
  it('R7 sends one POST to the Interactions endpoint with the key only in the x-goog-api-key header', async () => {
    const { fetchImpl, calls } = fakeFetch(reply(answerWith([{ type: 'image', mime_type: 'image/jpeg', data: 'SGk=' }])));
    await createGeminiImageGenerator(fetchImpl).generate(request(), ctx());
    expect(calls).toHaveLength(1);
    expect(calls[0]?.url).toBe('https://generativelanguage.googleapis.com/v1beta/interactions');
    expect(calls[0]?.init.method).toBe('POST');
    const headers = calls[0]?.init.headers as Record<string, string>;
    expect(headers['x-goog-api-key']).toBe(KEY);
    expect(headers['content-type']).toBe('application/json');
    expect(String(calls[0]?.url)).not.toContain(KEY);
    expect(String(calls[0]?.init.body)).not.toContain(KEY);
  });

  it('R7 the body holds the prompt, the encoded atlas, then the references, with the chosen size and level', async () => {
    const { fetchImpl, calls } = fakeFetch(reply(answerWith([{ type: 'image', mime_type: 'image/jpeg', data: 'SGk=' }])));
    const reference = new Blob([new Uint8Array([1, 2, 3])], { type: 'image/webp' });
    await createGeminiImageGenerator(fetchImpl).generate(request({ references: [reference], resolutionKey: '4K', sizePx: 4096, quality: 'high' }), ctx());
    const body = JSON.parse(String(calls[0]?.init.body));
    expect(body.input.map((part: { type: string; mime_type?: string }) => part.mime_type ?? part.type)).toEqual(['text', 'image/png', 'image/webp']);
    expect(body.input[2].data).toBe('AQID');
    expect(body.response_format).toMatchObject({ mime_type: 'image/jpeg', aspect_ratio: '1:1', image_size: '4K' });
    expect(body.generation_config).toEqual({ thinking_level: 'high' });
  });

  it('R7 returns the generated image as a Blob with its type', async () => {
    const { fetchImpl } = fakeFetch(reply(answerWith([{ type: 'image', mime_type: 'image/jpeg', data: 'SGk=' }])));
    const result = await createGeminiImageGenerator(fetchImpl).generate(request(), ctx());
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.mimeType).toBe('image/jpeg');
    expect(result.value.blob.type).toBe('image/jpeg');
    expect(Array.from(new Uint8Array(await result.value.blob.arrayBuffer()))).toEqual([72, 105]);
  });

  it('R9 a 200 with only a text part is moderation and carries the text', async () => {
    const { fetchImpl } = fakeFetch(reply(answerWith([{ type: 'text', text: 'I cannot create that.' }])));
    const result = await createGeminiImageGenerator(fetchImpl).generate(request(), ctx());
    expect(result).toMatchObject({ ok: false, error: { category: 'moderation', details: 'I cannot create that.' } });
  });

  it('R9 a 200 reporting status failed is a retryable server error and no image is read', async () => {
    const { fetchImpl } = fakeFetch(reply({ status: 'failed', steps: [] }));
    expect(await createGeminiImageGenerator(fetchImpl).generate(request(), ctx())).toMatchObject({ ok: false, error: { category: 'server', retryable: true } });
  });

  it('R9 a wrong key (400 with API_KEY_INVALID, array body) is auth', async () => {
    const { fetchImpl } = fakeFetch(reply([{ error: { code: 400, message: 'API key not valid.', status: 'INVALID_ARGUMENT', details: [{ reason: 'API_KEY_INVALID' }] } }], 400));
    expect(await createGeminiImageGenerator(fetchImpl).generate(request(), ctx())).toMatchObject({ ok: false, error: { category: 'auth' } });
  });

  it('R9 an unknown model (404) is not-found and a 503 is server', async () => {
    expect(await createGeminiImageGenerator(fakeFetch(reply({ error: { message: 'Model not found', code: 'not_found' } }, 404)).fetchImpl).generate(request(), ctx())).toMatchObject({ ok: false, error: { category: 'not-found' } });
    expect(await createGeminiImageGenerator(fakeFetch(reply({}, 503)).fetchImpl).generate(request(), ctx())).toMatchObject({ ok: false, error: { category: 'server', retryable: true } });
  });

  it('R9 a request over the inline limit is refused before anything is sent', async () => {
    const { fetchImpl, calls } = fakeFetch(reply({}));
    const result = await createGeminiImageGenerator(fetchImpl).generate(request({ atlas: png(16 * 1024 * 1024) }), ctx());
    expect(result).toMatchObject({ ok: false, error: { category: 'bad-request' } });
    expect(calls).toHaveLength(0);
  });

  it('R4 a size Gemini has no name for is refused before anything is sent', async () => {
    const { fetchImpl, calls } = fakeFetch(reply({}));
    const result = await createGeminiImageGenerator(fetchImpl).generate(request({ resolutionKey: '2.8K', sizePx: 2880 }), ctx());
    expect(result).toMatchObject({ ok: false, error: { category: 'bad-request' } });
    expect(calls).toHaveLength(0);
  });

  it('R10 an already aborted signal sends nothing', async () => {
    const controller = new AbortController();
    controller.abort();
    const { fetchImpl, calls } = fakeFetch(reply({}));
    expect(await createGeminiImageGenerator(fetchImpl).generate(request(), ctx(controller.signal))).toMatchObject({ ok: false, error: { category: 'aborted' } });
    expect(calls).toHaveLength(0);
  });

  it('R10 an abort while waiting ends the call as aborted', async () => {
    const controller = new AbortController();
    const { fetchImpl } = fakeFetch(() => new Promise<Response>(() => undefined));
    const pending = createGeminiImageGenerator(fetchImpl).generate(request(), ctx(controller.signal));
    await Promise.resolve();
    controller.abort();
    expect(await pending).toMatchObject({ ok: false, error: { category: 'aborted' } });
  });

  it('R9 the per-model timeout from the call context is honoured', async () => {
    vi.useFakeTimers();
    try {
      const { fetchImpl } = fakeFetch(() => new Promise<Response>(() => undefined));
      const pending = createGeminiImageGenerator(fetchImpl).generate(request(), { ...ctx(), timeoutMs: 5000 });
      await vi.advanceTimersByTimeAsync(5001);
      expect(await pending).toMatchObject({ ok: false, error: { category: 'timeout' } });
    } finally {
      vi.useRealTimers();
    }
  });

  it('R14 no error text contains the key', async () => {
    const { fetchImpl } = fakeFetch(reply({ error: { message: `bad ${KEY}`, code: 'invalid_request' } }, 400));
    const result = await createGeminiImageGenerator(fetchImpl).generate(request(), ctx());
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.message).not.toContain(KEY);
  });
});

describe('createGeminiPromptEnhancer (R8)', () => {
  const enhanceRequest = { model: 'gemini-3.8-flash', prompt: 'weathered steel', atlas: png() };

  it('R8 posts the chosen text model with the prompt and the atlas and returns the answer text', async () => {
    const { fetchImpl, calls } = fakeFetch(reply(answerWith([{ type: 'text', text: ' A steel plate with scratches. ' }])));
    const result = await createGeminiPromptEnhancer(fetchImpl).enhance(enhanceRequest, ctx());
    expect(result).toEqual({ ok: true, value: 'A steel plate with scratches.' });
    const body = JSON.parse(String(calls[0]?.init.body));
    expect(body.model).toBe('gemini-3.8-flash');
    expect(body.input[1]).toMatchObject({ type: 'image', mime_type: 'image/png' });
    expect((calls[0]?.init.headers as Record<string, string>)['x-goog-api-key']).toBe(KEY);
  });

  it('R8 an answer with no text is a retryable server error', async () => {
    const { fetchImpl } = fakeFetch(reply(answerWith([])));
    expect(await createGeminiPromptEnhancer(fetchImpl).enhance(enhanceRequest, ctx())).toMatchObject({ ok: false, error: { category: 'server', retryable: true } });
  });

  it('R9 a provider error is classified like the image call', async () => {
    const { fetchImpl } = fakeFetch(reply({ error: { message: 'slow down', code: 'rate_limit' } }, 429));
    expect(await createGeminiPromptEnhancer(fetchImpl).enhance(enhanceRequest, ctx())).toMatchObject({ ok: false, error: { category: 'rate-limit' } });
  });

  it('R10 an already aborted signal sends nothing', async () => {
    const controller = new AbortController();
    controller.abort();
    const { fetchImpl, calls } = fakeFetch(reply({}));
    expect(await createGeminiPromptEnhancer(fetchImpl).enhance(enhanceRequest, ctx(controller.signal))).toMatchObject({ ok: false, error: { category: 'aborted' } });
    expect(calls).toHaveLength(0);
  });
});
