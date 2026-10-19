import { afterEach, describe, expect, it, vi } from 'vitest';
import { DEFAULT_TIMEOUT_MS, type CallContext } from '../../../src/generation/providers/providerTypes';
import { sendProviderRequest, type ProviderRequest } from '../../../src/generation/providers/sendProviderRequest';

afterEach(() => vi.useRealTimers());

const KEY = 'sk-test-key-123456';
const REQUEST: ProviderRequest = { provider: 'openai', url: 'https://api.example.test/v1/images', method: 'POST', headers: { Authorization: `Bearer ${KEY}` }, body: '{"a":1}' };

function context(patch: Partial<CallContext> = {}): CallContext & { controller: AbortController } {
  const controller = new AbortController();
  return { apiKey: KEY, signal: controller.signal, controller, ...patch };
}

const json = (status: number, body: unknown, headers: Record<string, string> = {}): Response =>
  new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json', ...headers } });

// A fetch that waits until the signal it was given is aborted, then rejects as a real fetch does.
function hangingFetch(): typeof fetch {
  return ((_url: unknown, init?: RequestInit) =>
    new Promise<Response>((_resolve, reject) => {
      init?.signal?.addEventListener('abort', () => reject(new DOMException('aborted', 'AbortError')));
    })) as typeof fetch;
}

describe('sendProviderRequest: success and classification', () => {
  it('R13 a 2xx answer gives its parsed JSON body', async () => {
    const result = await sendProviderRequest(REQUEST, context(), async () => json(200, { data: [{ b64_json: 'AAAA' }] }));
    expect(result).toEqual({ ok: true, value: { data: [{ b64_json: 'AAAA' }] } });
  });

  it('R13 it sends exactly one request, with the url, method, headers and body it was given', async () => {
    const fetchImpl = vi.fn(async () => json(200, {}));
    await sendProviderRequest(REQUEST, context(), fetchImpl as unknown as typeof fetch);
    expect(fetchImpl).toHaveBeenCalledTimes(1);
    const [url, init] = fetchImpl.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe(REQUEST.url);
    expect(init).toMatchObject({ method: 'POST', headers: REQUEST.headers, body: '{"a":1}' });
  });

  it('R9 a non-2xx answer is classified by its status and body, and is not retried', async () => {
    const fetchImpl = vi.fn(async () => json(503, { error: { message: 'overloaded' } }));
    const result = await sendProviderRequest(REQUEST, context(), fetchImpl as unknown as typeof fetch);
    expect(result).toMatchObject({ ok: false, error: { category: 'server', retryable: true, status: 503, details: 'overloaded' } });
    expect(fetchImpl).toHaveBeenCalledTimes(1);
  });

  it('R9 a 429 carries the Retry-After header', async () => {
    const result = await sendProviderRequest(REQUEST, context(), async () => json(429, {}, { 'retry-after': '7' }));
    expect(result).toMatchObject({ ok: false, error: { category: 'rate-limit', retryAfterMs: 7000 } });
  });

  it('R9 a non-2xx answer whose body is not JSON is still classified by status', async () => {
    const result = await sendProviderRequest(REQUEST, context(), async () => new Response('<html>Bad gateway</html>', { status: 401 }));
    expect(result).toMatchObject({ ok: false, error: { category: 'auth', status: 401 } });
  });

  it('R9 a 2xx answer whose body is not JSON is a server error', async () => {
    const result = await sendProviderRequest(REQUEST, context(), async () => new Response('not json', { status: 200 }));
    expect(result).toMatchObject({ ok: false, error: { category: 'server', retryable: true } });
  });

  it('R13 a fetch that rejects with no response is network-or-blocked', async () => {
    const result = await sendProviderRequest(REQUEST, context(), async () => {
      throw new TypeError('Failed to fetch');
    });
    expect(result).toMatchObject({ ok: false, error: { category: 'network-or-blocked', retryable: true } });
  });

  it('R13 the Gemini 403 is auth and the OpenAI 403 is region', async () => {
    const gemini = await sendProviderRequest({ ...REQUEST, provider: 'gemini' }, context(), async () => json(403, {}));
    const openai = await sendProviderRequest(REQUEST, context(), async () => json(403, {}));
    expect(gemini).toMatchObject({ error: { category: 'auth' } });
    expect(openai).toMatchObject({ error: { category: 'region' } });
  });
});

describe('sendProviderRequest: abort and timeout', () => {
  it('R10 a signal that is already aborted sends nothing', async () => {
    const ctx = context();
    ctx.controller.abort();
    const fetchImpl = vi.fn(async () => json(200, {}));
    const result = await sendProviderRequest(REQUEST, ctx, fetchImpl as unknown as typeof fetch);
    expect(result).toMatchObject({ ok: false, error: { category: 'aborted' } });
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it('R10 an abort during the call gives aborted and aborts the request itself', async () => {
    const ctx = context();
    let sent: AbortSignal | undefined;
    const fetchImpl = ((url: string, init?: RequestInit) => {
      sent = init?.signal ?? undefined;
      return hangingFetch()(url, init);
    }) as typeof fetch;
    const pending = sendProviderRequest(REQUEST, ctx, fetchImpl);
    ctx.controller.abort();
    expect(await pending).toMatchObject({ ok: false, error: { category: 'aborted', retryable: false } });
    expect(sent?.aborted).toBe(true);
  });

  it('R10 an abort while the body is still being read gives aborted', async () => {
    const ctx = context();
    const stuckBody = { ok: true, status: 200, headers: new Headers(), json: () => new Promise(() => undefined) } as unknown as Response;
    const pending = sendProviderRequest(REQUEST, ctx, async () => stuckBody);
    await Promise.resolve();
    ctx.controller.abort();
    expect(await pending).toMatchObject({ ok: false, error: { category: 'aborted' } });
  });

  it('R9 no answer within the timeout gives timeout (retryable), by default after 180 seconds', async () => {
    vi.useFakeTimers();
    const pending = sendProviderRequest(REQUEST, context(), hangingFetch());
    await vi.advanceTimersByTimeAsync(DEFAULT_TIMEOUT_MS - 1);
    let settled = false;
    void pending.then(() => void (settled = true));
    await Promise.resolve();
    expect(settled).toBe(false);
    await vi.advanceTimersByTimeAsync(1);
    expect(await pending).toMatchObject({ ok: false, error: { category: 'timeout', retryable: true } });
  });

  it('R9 a model can ask for its own timeout', async () => {
    vi.useFakeTimers();
    const pending = sendProviderRequest(REQUEST, context({ timeoutMs: 5000 }), hangingFetch());
    await vi.advanceTimersByTimeAsync(5000);
    expect(await pending).toMatchObject({ error: { category: 'timeout' } });
  });

  it('R9 a timeout while the body is still being read gives timeout', async () => {
    vi.useFakeTimers();
    const stuckBody = { ok: true, status: 200, headers: new Headers(), json: () => new Promise(() => undefined) } as unknown as Response;
    const pending = sendProviderRequest(REQUEST, context({ timeoutMs: 1000 }), async () => stuckBody);
    await vi.advanceTimersByTimeAsync(1000);
    expect(await pending).toMatchObject({ error: { category: 'timeout' } });
  });

  it('R10 an abort after a timeout, or a timeout after an abort, keeps the first outcome', async () => {
    vi.useFakeTimers();
    const ctx = context({ timeoutMs: 1000 });
    const pending = sendProviderRequest(REQUEST, ctx, hangingFetch());
    ctx.controller.abort();
    await vi.advanceTimersByTimeAsync(5000);
    expect(await pending).toMatchObject({ error: { category: 'aborted' } });
  });

  it('R9 no timer or listener is left after the call settles', async () => {
    vi.useFakeTimers();
    const ctx = context();
    const result = await sendProviderRequest(REQUEST, ctx, async () => json(200, {}));
    expect(vi.getTimerCount()).toBe(0);
    ctx.controller.abort(); // an abort after the answer changes nothing
    expect(result.ok).toBe(true);
  });
});

describe('sendProviderRequest: the key (R14)', () => {
  it('R14 a url that contains the key is refused as a programmer error, before anything is sent', async () => {
    const fetchImpl = vi.fn(async () => json(200, {}));
    await expect(sendProviderRequest({ ...REQUEST, url: `https://api.example.test/v1?key=${KEY}` }, context(), fetchImpl as unknown as typeof fetch)).rejects.toThrow(/key/i);
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it('R14 no error it builds contains the key or a header, whatever the failure', async () => {
    const failures: Array<() => Promise<Response>> = [
      async () => {
        throw new TypeError(`Failed to fetch https://x/?k=${KEY}`);
      },
      async () => json(401, { error: { message: 'bad key' } }),
      async () => new Response('x', { status: 200 }),
    ];
    for (const fail of failures) {
      const result = await sendProviderRequest(REQUEST, context(), fail as unknown as typeof fetch);
      expect(JSON.stringify(result)).not.toContain(KEY);
      expect(JSON.stringify(result)).not.toContain('Bearer');
    }
  });

  it('R14 an empty key is not treated as being in every url', async () => {
    const result = await sendProviderRequest(REQUEST, context({ apiKey: '' }), async () => json(200, {}));
    expect(result.ok).toBe(true);
  });
});
