import { classifyProviderError, makeProviderError } from './classifyProviderError';
import { DEFAULT_TIMEOUT_MS, type CallContext, type Provider, type ProviderError, type ProviderErrorCategory, type Result } from './providerTypes';

export interface ProviderRequest {
  provider: Provider;
  url: string; // never contains the key
  method: 'GET' | 'POST';
  headers: Record<string, string>; // the adapter puts the key here
  body?: string | FormData | Blob;
}

const failed = (error: ProviderError): Result<never, ProviderError> => ({ ok: false, error });

/**
 * Sends one provider request directly from the browser (generate R9, R10, R13, R14): no retries, never throws for provider or network
 * failures. A 2xx answer gives its parsed JSON; a non-2xx answer is classified from its status and body; an abort, the timeout (default 180 s)
 * or a fetch that rejects each give their own category, whether they happen before the answer or while its body is being read. The key is
 * not read here: a URL that contains it is a programmer error and throws before anything is sent.
 */
export async function sendProviderRequest(request: ProviderRequest, ctx: CallContext, fetchImpl: typeof fetch = fetch): Promise<Result<unknown, ProviderError>> {
  if (ctx.apiKey.length > 0 && request.url.includes(ctx.apiKey)) throw new Error('The API key must not be in the URL: send it in a header.');
  if (ctx.signal.aborted) return failed(makeProviderError('aborted'));

  const controller = new AbortController();
  let interruption: ProviderError | null = null; // set once, by the first of abort and timeout
  const interrupt = (category: ProviderErrorCategory): void => {
    if (interruption !== null) return;
    interruption = makeProviderError(category);
    controller.abort();
  };
  const interrupted = new Promise<Result<never, ProviderError>>((resolve) => {
    controller.signal.addEventListener('abort', () => resolve(failed(interruption ?? makeProviderError('aborted'))), { once: true });
  });
  const onAbort = (): void => interrupt('aborted');
  ctx.signal.addEventListener('abort', onAbort, { once: true });
  const timer = setTimeout(() => interrupt('timeout'), ctx.timeoutMs ?? DEFAULT_TIMEOUT_MS);

  const exchange = async (): Promise<Result<unknown, ProviderError>> => {
    try {
      const init: RequestInit = { method: request.method, headers: request.headers, signal: controller.signal };
      if (request.body !== undefined) init.body = request.body;
      const response = await fetchImpl(request.url, init);
      let body: unknown = null;
      let readable = true;
      try {
        body = await response.json();
      } catch {
        readable = false;
      }
      if (interruption !== null) return failed(interruption);
      if (response.ok) return readable ? { ok: true, value: body } : failed(makeProviderError('server', { status: response.status }));
      return failed(classifyProviderError(request.provider, response.status, readable ? body : null, response.headers.get('retry-after')));
    } catch {
      // The text of the rejection is not used: it can name the url or the request.
      return failed(interruption ?? makeProviderError('network-or-blocked'));
    }
  };

  try {
    return await Promise.race([exchange(), interrupted]);
  } finally {
    clearTimeout(timer);
    ctx.signal.removeEventListener('abort', onAbort);
  }
}
