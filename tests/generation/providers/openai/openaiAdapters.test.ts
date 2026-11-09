import { describe, expect, it, vi } from 'vitest';
import type { GenerateRequest } from '../../../../src/generation/providers/ImageGenerator';
import { createOpenAiImageGenerator } from '../../../../src/generation/providers/openai/openaiImageGenerator';
import { createOpenAiPromptEnhancer } from '../../../../src/generation/providers/openai/openaiPromptEnhancer';

const KEY = 'sk-test-key-0123456789';
const png = (text = 'atlas'): Blob => new Blob([text], { type: 'image/png' });
const ctx = (signal = new AbortController().signal) => ({ apiKey: KEY, signal });
const request = (patch: Partial<GenerateRequest> = {}): GenerateRequest => ({ model: 'gpt-image-2.5-sunburst', prompt: 'weathered steel', atlas: png(), references: [], resolutionKey: '1K', sizePx: 1024, quality: 'auto', ...patch });
const reply = (body: unknown, status = 200): Response => new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });

function fakeFetch(response: Response | (() => Promise<Response>)) {
  const calls: { url: string; init: RequestInit }[] = [];
  const fetchImpl = vi.fn(async (url: string | URL | Request, init?: RequestInit) => {
    calls.push({ url: String(url), init: init ?? {} });
    return typeof response === 'function' ? response() : response.clone();
  });
  return { fetchImpl: fetchImpl as unknown as typeof fetch, calls };
}

describe('createOpenAiImageGenerator (R7, R14)', () => {
  it('R7 sends one multipart POST to the edits endpoint with the key only in the Authorization header', async () => {
    const { fetchImpl, calls } = fakeFetch(reply({ data: [{ b64_json: 'SGk=' }] }));
    await createOpenAiImageGenerator(fetchImpl).generate(request(), ctx());
    expect(calls).toHaveLength(1);
    expect(calls[0]?.url).toBe('https://api.openai.com/v1/images/edits');
    expect(calls[0]?.init.method).toBe('POST');
    const headers = calls[0]?.init.headers as Record<string, string>;
    expect(headers['Authorization']).toBe(`Bearer ${KEY}`);
    expect(Object.keys(headers).map((name) => name.toLowerCase())).not.toContain('content-type');
    expect(calls[0]?.init.body).toBeInstanceOf(FormData);
    expect(calls[0]?.url).not.toContain(KEY);
  });

  it('R7 the form holds the atlas and references under the image field, with the size and quality', async () => {
    const { fetchImpl, calls } = fakeFetch(reply({ data: [{ b64_json: 'SGk=' }] }));
    await createOpenAiImageGenerator(fetchImpl).generate(request({ references: [png('ref')], resolutionKey: '2.8K', sizePx: 2880, quality: 'xhigh' }), ctx());
    const form = calls[0]?.init.body as FormData;
    expect(form.get('size')).toBe('2880x2880');
    expect(form.get('quality')).toBe('xhigh');
    expect(form.getAll('image[]')).toHaveLength(2);
    for (const value of form.values()) if (typeof value === 'string') expect(value).not.toContain(KEY);
  });

  it('R7 a GPT Image 2.6 model is sent complexity medium, a 2.5 model none, and a request can set its own', async () => {
    const sentComplexity = async (patch: Partial<GenerateRequest>): Promise<FormDataEntryValue | null> => {
      const { fetchImpl, calls } = fakeFetch(reply({ data: [{ b64_json: 'SGk=' }] }));
      await createOpenAiImageGenerator(fetchImpl).generate(request(patch), ctx());
      return (calls[0]?.init.body as FormData).get('complexity');
    };
    expect(await sentComplexity({ model: 'gpt-image-2.6-sunburst' })).toBe('medium');
    expect(await sentComplexity({ model: 'gpt-image-2.6-flare' })).toBe('medium');
    expect(await sentComplexity({ model: 'gpt-image-2.5-sunburst' })).toBeNull();
    expect(await sentComplexity({ model: 'gpt-image-2.6-sunburst', complexity: 'low' })).toBe('low');
  });

  it('R7 returns the generated PNG as a Blob', async () => {
    const { fetchImpl } = fakeFetch(reply({ data: [{ b64_json: 'SGk=' }] }));
    const result = await createOpenAiImageGenerator(fetchImpl).generate(request(), ctx());
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.mimeType).toBe('image/png');
    expect(Array.from(new Uint8Array(await result.value.blob.arrayBuffer()))).toEqual([72, 105]);
  });

  it('R9 a moderation block (400 moderation_blocked) is moderation and not retryable', async () => {
    const { fetchImpl } = fakeFetch(reply({ error: { type: 'image_generation_user_error', code: 'moderation_blocked', message: 'Blocked by safety system' } }, 400));
    expect(await createOpenAiImageGenerator(fetchImpl).generate(request(), ctx())).toMatchObject({ ok: false, error: { category: 'moderation', retryable: false, details: 'Blocked by safety system' } });
  });

  it('R9 401 is auth, 403 is region, 429 with a quota code is quota, 503 is server', async () => {
    const cases: [number, unknown, string][] = [
      [401, { error: { message: 'bad key' } }, 'auth'],
      [403, { error: { message: 'country' } }, 'region'],
      [429, { error: { code: 'insufficient_quota' } }, 'quota'],
      [503, {}, 'server'],
    ];
    for (const [status, body, category] of cases) {
      const result = await createOpenAiImageGenerator(fakeFetch(reply(body, status)).fetchImpl).generate(request(), ctx());
      expect(result, String(status)).toMatchObject({ ok: false, error: { category } });
    }
  });

  it('R9 a 200 without an image is a server error', async () => {
    expect(await createOpenAiImageGenerator(fakeFetch(reply({ data: [] })).fetchImpl).generate(request(), ctx())).toMatchObject({ ok: false, error: { category: 'server' } });
  });

  it('R4 4K is refused before anything is sent', async () => {
    const { fetchImpl, calls } = fakeFetch(reply({}));
    expect(await createOpenAiImageGenerator(fetchImpl).generate(request({ resolutionKey: '4K', sizePx: 4096 }), ctx())).toMatchObject({ ok: false, error: { category: 'bad-request' } });
    expect(calls).toHaveLength(0);
  });

  it('R10 an aborted signal sends nothing and an abort while waiting is aborted', async () => {
    const done = new AbortController();
    done.abort();
    const sent = fakeFetch(reply({}));
    expect(await createOpenAiImageGenerator(sent.fetchImpl).generate(request(), ctx(done.signal))).toMatchObject({ ok: false, error: { category: 'aborted' } });
    expect(sent.calls).toHaveLength(0);

    const live = new AbortController();
    const pending = createOpenAiImageGenerator(fakeFetch(() => new Promise<Response>(() => undefined)).fetchImpl).generate(request(), ctx(live.signal));
    await Promise.resolve();
    live.abort();
    expect(await pending).toMatchObject({ ok: false, error: { category: 'aborted' } });
  });

  it('R14 no error text contains the key', async () => {
    const { fetchImpl } = fakeFetch(reply({ error: { message: `bad ${KEY}` } }, 400));
    const result = await createOpenAiImageGenerator(fetchImpl).generate(request(), ctx());
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.message).not.toContain(KEY);
  });
});

describe('createOpenAiPromptEnhancer (R8)', () => {
  const enhanceRequest = { model: 'gpt-6-astra', prompt: 'weathered steel', atlas: png(), level: null };
  const answer = (text: string) => ({ output: [{ type: 'message', content: [{ type: 'output_text', text }] }] });

  it('R8 sends the request level as reasoning.effort, and no reasoning field without one', async () => {
    const withLevel = fakeFetch(reply(answer('A steel plate.')));
    await createOpenAiPromptEnhancer(withLevel.fetchImpl).enhance({ ...enhanceRequest, model: 'gpt-6-luna', level: 'none' }, ctx());
    expect(JSON.parse(String(withLevel.calls[0]?.init.body)).reasoning).toEqual({ effort: 'none' });
    const without = fakeFetch(reply(answer('A steel plate.')));
    await createOpenAiPromptEnhancer(without.fetchImpl).enhance(enhanceRequest, ctx());
    expect('reasoning' in JSON.parse(String(without.calls[0]?.init.body))).toBe(false);
  });

  it('R8 posts the chosen text model with the prompt and the atlas as JSON and returns the text', async () => {
    const { fetchImpl, calls } = fakeFetch(reply(answer(' A steel plate. ')));
    expect(await createOpenAiPromptEnhancer(fetchImpl).enhance(enhanceRequest, ctx())).toEqual({ ok: true, value: 'A steel plate.' });
    expect(calls[0]?.url).toBe('https://api.openai.com/v1/responses');
    const headers = calls[0]?.init.headers as Record<string, string>;
    expect(headers['Authorization']).toBe(`Bearer ${KEY}`);
    expect(headers['content-type']).toBe('application/json');
    const body = JSON.parse(String(calls[0]?.init.body));
    expect(body.model).toBe('gpt-6-astra');
    expect(body.input[0].content[1].image_url).toMatch(/^data:image\/png;base64,/);
    expect(String(calls[0]?.init.body)).not.toContain(KEY);
  });

  it('R8 an answer with no text is a retryable server error', async () => {
    expect(await createOpenAiPromptEnhancer(fakeFetch(reply({ output: [] })).fetchImpl).enhance(enhanceRequest, ctx())).toMatchObject({ ok: false, error: { category: 'server', retryable: true } });
  });

  it('R9 a provider error is classified like the image call', async () => {
    expect(await createOpenAiPromptEnhancer(fakeFetch(reply({ error: { message: 'slow' } }, 429)).fetchImpl).enhance(enhanceRequest, ctx())).toMatchObject({ ok: false, error: { category: 'rate-limit' } });
  });

  it('R10 an aborted signal sends nothing', async () => {
    const done = new AbortController();
    done.abort();
    const { fetchImpl, calls } = fakeFetch(reply({}));
    expect(await createOpenAiPromptEnhancer(fetchImpl).enhance(enhanceRequest, ctx(done.signal))).toMatchObject({ ok: false, error: { category: 'aborted' } });
    expect(calls).toHaveLength(0);
  });
});
