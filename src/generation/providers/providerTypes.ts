import type { Provider } from '../../keys';

export type { Provider };

export type ProviderErrorCategory =
  | 'auth'
  | 'region'
  | 'not-found'
  | 'rate-limit'
  | 'quota'
  | 'moderation'
  | 'bad-request'
  | 'server'
  | 'timeout'
  | 'network-or-blocked'
  | 'aborted';

export interface ProviderError {
  category: ProviderErrorCategory;
  retryable: boolean; // a manual Retry makes sense without changing anything
  status?: number;
  message: string; // the fixed text for the category
  details?: string; // the provider's own text, shown as plain text in a collapsed block
  retryAfterMs?: number; // rate-limit only
}

export type Result<T, E> = { ok: true; value: T } | { ok: false; error: E };

// What every provider call needs. The key is passed per call and never stored (R14).
export interface CallContext {
  apiKey: string;
  signal: AbortSignal;
  timeoutMs?: number; // default DEFAULT_TIMEOUT_MS; models may ask for more
}

export const DEFAULT_TIMEOUT_MS = 180_000;
