import { describe, expect, it } from 'vitest';
import { classifyOkBody, classifyProviderError } from '../../../src/generation/providers/classifyProviderError';

const body = (error: Record<string, unknown>): unknown => ({ error });

describe('classifyProviderError: the status table', () => {
  it.each([
    ['gemini', 401, 'auth', false],
    ['openai', 401, 'auth', false],
    ['gemini', 403, 'auth', false],
    ['openai', 403, 'region', false],
    ['gemini', 404, 'not-found', false],
    ['openai', 404, 'not-found', false],
    ['gemini', 400, 'bad-request', false],
    ['openai', 400, 'bad-request', false],
    ['openai', 402, 'quota', false],
    ['gemini', 402, 'quota', false],
    ['gemini', 429, 'rate-limit', true],
    ['openai', 429, 'rate-limit', true],
    ['gemini', 500, 'server', true],
    ['gemini', 503, 'server', true],
    ['openai', 504, 'server', true],
  ] as const)('R9 %s %i is %s (retryable %s)', (provider, status, category, retryable) => {
    const error = classifyProviderError(provider, status, null);
    expect(error.category).toBe(category);
    expect(error.retryable).toBe(retryable);
    expect(error.status).toBe(status);
  });

  it('R9 statuses the table does not list: 408 is a timeout, other 4xx are bad requests, other 5xx are server errors', () => {
    expect(classifyProviderError('openai', 408, null)).toMatchObject({ category: 'timeout', retryable: true });
    expect(classifyProviderError('openai', 422, null)).toMatchObject({ category: 'bad-request', retryable: false });
    expect(classifyProviderError('openai', 502, null)).toMatchObject({ category: 'server', retryable: true });
  });

  it('R9 every category has its own fixed message, and the message does not depend on the body', () => {
    const plain = classifyProviderError('openai', 401, null).message;
    expect(plain.length).toBeGreaterThan(10);
    expect(classifyProviderError('openai', 401, body({ message: 'sk-secret leaked' })).message).toBe(plain);
    expect(classifyProviderError('openai', 403, null).message).not.toBe(plain);
  });
});

describe('classifyProviderError: body codes refine, never override the status', () => {
  it('R9 a 400 with moderation_blocked is moderation (not retryable)', () => {
    expect(classifyProviderError('openai', 400, body({ code: 'moderation_blocked', message: 'blocked' }))).toMatchObject({ category: 'moderation', retryable: false });
  });

  it('R9 a 429 with a quota code is quota, whichever field carries it', () => {
    for (const field of [{ code: 'insufficient_quota' }, { type: 'insufficient_quota' }, { status: 'quota_exceeded' }, { code: 'billing_hard_limit_reached' }]) {
      expect(classifyProviderError('openai', 429, body(field)).category).toBe('quota');
    }
  });

  it('R9 a 429 whose message says the current quota is exceeded is quota', () => {
    expect(classifyProviderError('openai', 429, body({ message: 'You exceeded your current quota, please check your plan' })).category).toBe('quota');
  });

  it('R9 any other 429 stays rate-limit even with an unrelated body', () => {
    expect(classifyProviderError('openai', 429, body({ code: 'rate_limit_exceeded' })).category).toBe('rate-limit');
  });

  it('R9 a billing code on another 4xx is quota', () => {
    expect(classifyProviderError('openai', 400, body({ code: 'billing_not_active' })).category).toBe('quota');
  });

  it('R9 a body code never turns a 5xx into something else', () => {
    expect(classifyProviderError('openai', 503, body({ code: 'moderation_blocked' })).category).toBe('server');
  });

  it('R9 a body that is not an object, or has no error, adds nothing', () => {
    for (const odd of ['text', 12, [], { other: 1 }, { error: 'string' }, undefined]) {
      expect(classifyProviderError('gemini', 400, odd).category).toBe('bad-request');
    }
  });
});

describe('classifyProviderError: details and Retry-After', () => {
  it('R9 the provider message goes to details as plain text', () => {
    expect(classifyProviderError('gemini', 400, body({ message: '<b>Invalid</b> size' })).details).toBe('<b>Invalid</b> size');
  });

  it('R9 details are cut at 2000 characters and absent without a message', () => {
    expect(classifyProviderError('gemini', 400, body({ message: 'x'.repeat(5000) })).details).toHaveLength(2000);
    expect(classifyProviderError('gemini', 400, body({})).details).toBeUndefined();
    expect(classifyProviderError('gemini', 400, body({ message: '' })).details).toBeUndefined();
  });

  it('R9 a rate limit waits for Retry-After in seconds', () => {
    expect(classifyProviderError('openai', 429, null, '12').retryAfterMs).toBe(12_000);
  });

  it('R9 a rate limit reads an HTTP-date Retry-After', () => {
    const now = Date.parse('2026-10-19T10:00:00Z');
    expect(classifyProviderError('openai', 429, null, 'Mon, 19 Oct 2026 10:00:20 GMT', now).retryAfterMs).toBe(20_000);
  });

  it('R9 without a readable Retry-After the wait is 30 seconds', () => {
    for (const header of [undefined, null, '', 'soon', '-5']) {
      expect(classifyProviderError('openai', 429, null, header).retryAfterMs).toBe(30_000);
    }
  });

  it('R9 only a rate limit carries retryAfterMs', () => {
    expect(classifyProviderError('openai', 503, null, '12').retryAfterMs).toBeUndefined();
  });
});

describe('classifyOkBody: a 200 that is an error', () => {
  it('R9 status failed or incomplete is a retryable server error with the reported text', () => {
    expect(classifyOkBody({ status: 'failed', error: { message: 'could not render' } })).toMatchObject({ category: 'server', retryable: true, details: 'could not render' });
    expect(classifyOkBody({ status: 'incomplete' })).toMatchObject({ category: 'server', retryable: true });
  });

  it('R9 a non-empty errors array is a server error and its first message is the details', () => {
    expect(classifyOkBody({ errors: [{ message: 'first' }, { message: 'second' }] })).toMatchObject({ category: 'server', details: 'first' });
  });

  it('R9 a good body, an empty errors array, other statuses and odd values are not errors', () => {
    for (const fine of [{ status: 'completed' }, { errors: [] }, { status: 'in_progress' }, {}, null, 'text', 3, undefined]) {
      expect(classifyOkBody(fine)).toBeNull();
    }
  });
});
