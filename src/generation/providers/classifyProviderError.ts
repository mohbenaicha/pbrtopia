import type { Provider, ProviderError, ProviderErrorCategory } from './providerTypes';

const MESSAGES: Readonly<Record<ProviderErrorCategory, string>> = {
  auth: 'The provider rejected the API key. Open Settings to check it.',
  region: 'This provider is not available in your region. The key is fine, so Settings will not help.',
  'not-found': 'This model is unavailable. Choose another model.',
  'rate-limit': 'Too many requests. Wait a moment, then try again.',
  quota: 'The billing limit or quota for this key is used up.',
  moderation: "The provider's safety filter blocked this. Change the prompt or the reference images.",
  'bad-request': 'The provider rejected the request. Try another size, quality or set of references.',
  server: 'The provider is busy or could not finish. Try again.',
  timeout: 'The provider took too long to answer.',
  'network-or-blocked': 'The provider could not be reached: you may be offline, or the browser blocked the call (CORS).',
  aborted: '',
};

const RETRYABLE: ReadonlySet<ProviderErrorCategory> = new Set(['rate-limit', 'server', 'timeout', 'network-or-blocked']);
const QUOTA_CODES: ReadonlySet<string> = new Set(['quota_exceeded', 'insufficient_quota', 'billing_hard_limit_reached', 'billing_not_active']);
const MODERATION_CODE = 'moderation_blocked';
const QUOTA_MESSAGE = /exceeded your current quota/i;
const DEFAULT_RETRY_AFTER_MS = 30_000;
const MAX_DETAILS_LENGTH = 2000;

/** The fixed error for a category, with the status and the provider's own text when there is some. */
export function makeProviderError(category: ProviderErrorCategory, extra: Pick<ProviderError, 'status' | 'details' | 'retryAfterMs'> = {}): ProviderError {
  const error: ProviderError = { category, retryable: RETRYABLE.has(category), message: MESSAGES[category] };
  if (extra.status !== undefined) error.status = extra.status;
  if (extra.details !== undefined) error.details = extra.details;
  if (extra.retryAfterMs !== undefined) error.retryAfterMs = extra.retryAfterMs;
  return error;
}

const asRecord = (value: unknown): Record<string, unknown> | null => (typeof value === 'object' && value !== null && !Array.isArray(value) ? (value as Record<string, unknown>) : null);

// The `error` object of a provider body, or null.
const errorObjectOf = (body: unknown): Record<string, unknown> | null => asRecord(asRecord(body)?.error);

const detailsOf = (text: unknown): string | undefined => (typeof text === 'string' && text.length > 0 ? text.slice(0, MAX_DETAILS_LENGTH) : undefined);

function codesOf(error: Record<string, unknown> | null): string[] {
  if (error === null) return [];
  return [error.code, error.type, error.status].filter((value): value is string => typeof value === 'string').map((value) => value.toLowerCase());
}

// The wait before a manual retry: Retry-After as seconds or an HTTP date, else a fixed 30 s.
function parseRetryAfterMs(header: string | null | undefined, now: number): number {
  if (header === undefined || header === null) return DEFAULT_RETRY_AFTER_MS;
  const text = header.trim();
  if (/^\d+(\.\d+)?$/.test(text)) return Math.round(Number(text) * 1000);
  if (/[a-z]/i.test(text)) {
    const at = Date.parse(text);
    if (Number.isFinite(at)) return Math.max(0, at - now);
  }
  return DEFAULT_RETRY_AFTER_MS;
}

function categoryOf(provider: Provider, status: number, error: Record<string, unknown> | null): ProviderErrorCategory {
  const codes = codesOf(error);
  const isQuota = codes.some((code) => QUOTA_CODES.has(code)) || QUOTA_MESSAGE.test(typeof error?.message === 'string' ? error.message : '');
  if (status === 401) return 'auth';
  if (status === 403) return provider === 'openai' ? 'region' : 'auth';
  if (status === 404) return 'not-found';
  if (status === 408) return 'timeout';
  if (status === 429) return isQuota ? 'quota' : 'rate-limit';
  if (status >= 500) return 'server';
  if (status === 402 || isQuota) return 'quota';
  if (codes.includes(MODERATION_CODE)) return 'moderation';
  return 'bad-request';
}

/**
 * Generate R9, R13: the error for a non-2xx answer. The status decides; body codes only refine (a 400 with moderation_blocked is moderation, a 429
 * or other 4xx with a billing code is quota). The provider's own text goes to `details` as plain text; `message` is the fixed text for the category.
 */
export function classifyProviderError(provider: Provider, status: number, body: unknown, retryAfterHeader?: string | null, now: number = Date.now()): ProviderError {
  const error = errorObjectOf(body);
  const category = categoryOf(provider, status, error);
  const details = detailsOf(error?.message);
  return makeProviderError(category, {
    status,
    ...(details === undefined ? {} : { details }),
    ...(category === 'rate-limit' ? { retryAfterMs: parseRetryAfterMs(retryAfterHeader, now) } : {}),
  });
}

/** A 2xx body that reports a failure (status failed or incomplete, or a non-empty errors list) is a retryable server error; otherwise null. */
export function classifyOkBody(body: unknown): ProviderError | null {
  const record = asRecord(body);
  if (record === null) return null;
  const errors = Array.isArray(record.errors) ? record.errors : [];
  const failed = record.status === 'failed' || record.status === 'incomplete';
  if (!failed && errors.length === 0) return null;
  const reported = detailsOf(asRecord(errors[0])?.message) ?? detailsOf(errorObjectOf(record)?.message);
  return makeProviderError('server', reported === undefined ? {} : { details: reported });
}
