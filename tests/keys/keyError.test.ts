import { describe, expect, it } from 'vitest';
import { KEY_OK, keyFailure, type KeyError } from '../../src/keys/keyError';

type Code = KeyError['code'];
const ALL_CODES: Code[] = ['wrong-password', 'password-cancelled', 'weak-password', 'password-mismatch', 'invalid-key', 'vault-changed', 'vault-missing', 'crypto-unavailable', 'storage-failed'];

describe('keyFailure', () => {
  it('api-keys R2 gives a failed result carrying the code asked for and a message in plain words', () => {
    for (const code of ALL_CODES) {
      const failure = keyFailure(code);
      expect(failure.ok, code).toBe(false);
      expect(failure.error.code).toBe(code);
      expect(failure.error.message.length, code).toBeGreaterThan(10);
    }
  });

  it('api-keys R2 every code has its own message, so the person can tell the failures apart', () => {
    const messages = ALL_CODES.map((code) => keyFailure(code).error.message);
    expect(new Set(messages).size).toBe(ALL_CODES.length);
  });

  it('api-keys R5 a wrong password says so in fixed words that carry no password or key', () => {
    expect(keyFailure('wrong-password').error.message).toBe('That password is not right.');
    expect(keyFailure('wrong-password')).toEqual(keyFailure('wrong-password'));
  });

  it('api-keys R10 a vault changed in another tab is reported with its own code, telling the person to try again', () => {
    const failure = keyFailure('vault-changed');
    expect(failure.error.code).toBe('vault-changed');
    expect(failure.error.message).toContain('another tab');
  });

  it('api-keys R3 the password rules are stated in the messages: at least 8 characters, and two matching entries', () => {
    expect(keyFailure('weak-password').error.message).toContain('8 characters');
    expect(keyFailure('password-mismatch').error.message).toContain('not the same');
    expect(keyFailure('invalid-key').error.message).toContain('8 characters');
  });

  it('api-keys R2 each call gives a fresh result, so changing one does not change the next', () => {
    const first = keyFailure('storage-failed');
    first.error.message = 'changed';
    expect(keyFailure('storage-failed').error.message).not.toBe('changed');
  });
});

describe('KEY_OK', () => {
  it('api-keys R2 is the successful result with no value', () => {
    expect(KEY_OK).toEqual({ ok: true, value: undefined });
  });
});
