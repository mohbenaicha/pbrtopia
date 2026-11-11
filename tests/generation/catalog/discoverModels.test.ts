import { describe, expect, it, vi } from 'vitest';
import { discoverModels } from '../../../src/generation/catalog/discoverModels';

const TODAY = '2026-10-19';
const KEY = 'test-key-98765';
const signal = new AbortController().signal;

const json = (status: number, body: unknown): Response => new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });
const fetchOf = (...answers: Response[]) => vi.fn(async () => answers.shift() ?? json(500, {}));
const discover = (provider: 'gemini' | 'openai', fetchImpl: ReturnType<typeof fetchOf>) => discoverModels(provider, KEY, signal, { fetchImpl: fetchImpl as unknown as typeof fetch, today: TODAY });

describe('discoverModels: OpenAI', () => {
  const OPENAI_LIST = {
    object: 'list',
    data: [
      { id: 'gpt-image-2.5-sunburst', shutdown_date: null },
      { id: 'gpt-image-2.5-sunburst-2026-09-08' },
      { id: 'gpt-image-9-mystery' },
      { id: 'gpt-image-1', shutdown_date: '2026-10-01' },
      { id: 'gpt-image-1-mini', shutdown_date: '2027-02-02' },
      { id: 'gpt-6-luna' },
      { id: 'gpt-4o' },
    ],
  };

  it('R4 gives the filtered models joined to the table, with the table facts for known ids', async () => {
    const result = await discover('openai', fetchOf(json(200, OPENAI_LIST)));
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const sunburst = result.value.find((m) => m.id === 'gpt-image-2.5-sunburst');
    expect(sunburst).toMatchObject({ provider: 'openai', role: 'image', verified: true, displayName: 'GPT Image 2.5 Sunburst' });
    expect(sunburst?.resolutions.length).toBeGreaterThan(0);
    expect(sunburst?.qualityLevels).toContain('high');
  });

  it('R4 an id that is not in the table is marked unverified and offers no sizes or levels', async () => {
    const result = await discover('openai', fetchOf(json(200, OPENAI_LIST)));
    if (!result.ok) throw new Error('expected a list');
    expect(result.value.find((m) => m.id === 'gpt-image-9-mystery')).toEqual({ provider: 'openai', id: 'gpt-image-9-mystery', role: 'image', displayName: 'gpt-image-9-mystery', verified: false, resolutions: [], qualityLevels: [] });
  });

  it('R4 drops retired models and dated duplicates, keeps a retiring model with its date', async () => {
    const result = await discover('openai', fetchOf(json(200, OPENAI_LIST)));
    if (!result.ok) throw new Error('expected a list');
    const found = result.value.map((m) => m.id);
    expect(found).not.toContain('gpt-image-1');
    expect(found).not.toContain('gpt-image-2.5-sunburst-2026-09-08');
    expect(found).not.toContain('gpt-4o');
    expect(result.value.find((m) => m.id === 'gpt-image-1-mini')?.retiring).toEqual({ shutdownDate: '2027-02-02' });
  });

  it('R4 only table rows the provider lists are offered', async () => {
    const result = await discover('openai', fetchOf(json(200, { data: [{ id: 'gpt-image-2.5-flare' }] })));
    if (!result.ok) throw new Error('expected a list');
    expect(result.value.map((m) => m.id)).toEqual(['gpt-image-2.5-flare']);
  });

  it('R4 the result carries no table bookkeeping and is sorted: images first, verified first, then by id', async () => {
    const result = await discover('openai', fetchOf(json(200, OPENAI_LIST)));
    if (!result.ok) throw new Error('expected a list');
    expect(result.value[0]).not.toHaveProperty('verifiedAt');
    expect(result.value[0]).not.toHaveProperty('source');
    const order = (m: { role: string; verified: boolean; id: string }): string => `${m.role === 'image' ? 0 : 1}|${m.verified ? 0 : 1}|${m.id}`;
    const keys = result.value.map(order);
    expect(keys).toEqual([...keys].sort());
    expect(result.value.length).toBeGreaterThan(2);
    expect(result.value.at(-1)?.role).toBe('vision-text');
  });

  it('R4 sends one GET to the models endpoint with the key in the Authorization header only', async () => {
    const fetchImpl = fetchOf(json(200, { data: [] }));
    await discover('openai', fetchImpl);
    expect(fetchImpl).toHaveBeenCalledTimes(1);
    const [url, init] = fetchImpl.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe('https://api.openai.com/v1/models');
    expect(init.method).toBe('GET');
    expect(init.headers).toEqual({ Authorization: `Bearer ${KEY}` });
    expect(url).not.toContain(KEY);
  });
});

describe('discoverModels: Gemini', () => {
  const page = (names: string[], next?: string) => json(200, { models: names.map((name) => ({ name: `models/${name}`, supportedGenerationMethods: ['generateContent'] })), ...(next ? { nextPageToken: next } : {}) });

  it('R4 follows nextPageToken until it ends and sends the key as a header only', async () => {
    const fetchImpl = fetchOf(page(['gemini-3.1-flash-image'], 'two'), page(['gemini-3.8-flash']));
    const result = await discover('gemini', fetchImpl);
    if (!result.ok) throw new Error('expected a list');
    expect(result.value.map((m) => m.id).sort()).toEqual(['gemini-3.1-flash-image', 'gemini-3.8-flash']);
    const urls = fetchImpl.mock.calls.map((call) => (call as unknown as [string])[0]);
    expect(urls[0]).toBe('https://generativelanguage.googleapis.com/v1beta/models?pageSize=1000');
    expect(urls[1]).toBe('https://generativelanguage.googleapis.com/v1beta/models?pageSize=1000&pageToken=two');
    expect(urls.join()).not.toContain(KEY);
    expect((fetchImpl.mock.calls[0] as unknown as [string, RequestInit])[1].headers).toEqual({ 'x-goog-api-key': KEY });
  });

  it('R4 strips the models/ prefix and joins to the table', async () => {
    const result = await discover('gemini', fetchOf(page(['gemini-3.1-flash-image', 'gemini-future-image'])));
    if (!result.ok) throw new Error('expected a list');
    expect(result.value.find((m) => m.id === 'gemini-3.1-flash-image')).toMatchObject({ verified: true, role: 'image' });
    expect(result.value.find((m) => m.id === 'gemini-future-image')).toMatchObject({ verified: false, resolutions: [] });
  });

  it('R4 stops after 10 pages even if the provider keeps sending a token', async () => {
    const fetchImpl = vi.fn(async () => page(['gemini-3.8-flash'], 'again'));
    const result = await discoverModels('gemini', KEY, signal, { fetchImpl: fetchImpl as unknown as typeof fetch, today: TODAY });
    expect(result.ok).toBe(true);
    expect(fetchImpl).toHaveBeenCalledTimes(10);
  });
});

describe('discoverModels: failures', () => {
  it('R4 a rejected key comes back as the classified error, so the caller can reject the key', async () => {
    const result = await discover('openai', fetchOf(json(401, { error: { message: 'bad key' } })));
    expect(result).toMatchObject({ ok: false, error: { category: 'auth', status: 401 } });
  });

  it('R13 a failure on the second Gemini page is returned and nothing partial is given', async () => {
    const result = await discover('gemini', fetchOf(json(200, { models: [{ name: 'models/gemini-3.8-flash' }], nextPageToken: 't' }), json(503, {})));
    expect(result).toMatchObject({ ok: false, error: { category: 'server' } });
  });

  it('R13 a fetch that rejects is network-or-blocked', async () => {
    const fetchImpl = vi.fn(async () => {
      throw new TypeError('Failed to fetch');
    });
    const result = await discoverModels('openai', KEY, signal, { fetchImpl: fetchImpl as unknown as typeof fetch, today: TODAY });
    expect(result).toMatchObject({ ok: false, error: { category: 'network-or-blocked' } });
  });

  it('R10 an aborted signal sends nothing', async () => {
    const controller = new AbortController();
    controller.abort();
    const fetchImpl = fetchOf(json(200, { data: [] }));
    const result = await discoverModels('openai', KEY, controller.signal, { fetchImpl: fetchImpl as unknown as typeof fetch, today: TODAY });
    expect(result).toMatchObject({ ok: false, error: { category: 'aborted' } });
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it('R4 a list body of an unexpected shape gives an empty list, not a crash', async () => {
    for (const odd of [{}, { data: 'x' }, { data: [null, 5, { noId: true }] }, []]) {
      const result = await discover('openai', fetchOf(json(200, odd)));
      expect(result).toEqual({ ok: true, value: [] });
    }
  });
});
