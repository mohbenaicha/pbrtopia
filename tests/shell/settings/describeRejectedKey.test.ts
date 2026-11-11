import { describe, expect, it } from 'vitest';
import { describeRejectedKey } from '../../../src/shell/settings/describeRejectedKey';
import type { ProviderError, ProviderErrorCategory, Result } from '../../../src/generation';

const failure = (category: ProviderErrorCategory): Result<unknown, ProviderError> => ({ ok: false, error: { category, retryable: false, message: 'x' } });

describe('describeRejectedKey', () => {
  it('settings R4 an auth failure flags the key with the provider named', () => {
    expect(describeRejectedKey('gemini', failure('auth'))).toBe('Gemini refused this key. Check it and replace it.');
    expect(describeRejectedKey('openai', failure('auth'))).toBe('OpenAI refused this key. Check it and replace it.');
  });

  it('settings R4 a good answer flags nothing', () => {
    expect(describeRejectedKey('gemini', { ok: true, value: [] })).toBeNull();
  });

  it.each(['region', 'not-found', 'rate-limit', 'quota', 'moderation', 'bad-request', 'server', 'timeout', 'network-or-blocked', 'aborted'] as const)(
    'settings R4 a %s failure says nothing about the key',
    (category) => {
      expect(describeRejectedKey('gemini', failure(category))).toBeNull();
    },
  );
});
