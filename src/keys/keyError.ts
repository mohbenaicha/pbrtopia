export type KeyErrorCode =
  | 'wrong-password'
  | 'password-cancelled'
  | 'weak-password'
  | 'password-mismatch'
  | 'invalid-key'
  | 'vault-changed'
  | 'vault-missing'
  | 'crypto-unavailable'
  | 'storage-failed';

export interface KeyError {
  code: KeyErrorCode;
  message: string;
}

export type KeyResult<T> = { ok: true; value: T } | { ok: false; error: KeyError };

// Fixed texts: an error never carries a key, a password or a piece of either.
const MESSAGES: Record<KeyErrorCode, string> = {
  'wrong-password': 'That password is not right.',
  'password-cancelled': 'No password was entered.',
  'weak-password': 'The password must be at least 8 characters.',
  'password-mismatch': 'The two passwords are not the same.',
  'invalid-key': 'That key is not valid. Keys must be at least 8 characters.',
  'vault-changed': 'The keys were changed in another tab. Try again.',
  'vault-missing': 'There are no saved keys yet.',
  'crypto-unavailable': 'This browser cannot encrypt keys here. Use a secure page (https or localhost).',
  'storage-failed': 'The keys could not be read or saved by this browser.',
};

export function keyFailure(code: KeyErrorCode): { ok: false; error: KeyError } {
  return { ok: false, error: { code, message: MESSAGES[code] } };
}

export const KEY_OK: KeyResult<void> = { ok: true, value: undefined };
