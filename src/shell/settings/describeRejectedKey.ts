import type { ProviderError, Result } from '../../generation';
import type { Provider } from '../../keys';
import { PROVIDER_NAMES } from './providerNames';

/** Settings R4: the line for a key its provider refused; null for a good answer and for any failure that does not say the key is wrong. */
export function describeRejectedKey(provider: Provider, result: Result<unknown, ProviderError>): string | null {
  if (result.ok || result.error.category !== 'auth') return null;
  return `${PROVIDER_NAMES[provider]} refused this key. Check it and replace it.`;
}
