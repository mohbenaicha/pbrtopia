type KeyErrorCode =
  | 'wrong-password'
  | 'password-cancelled'
  | 'weak-password'
  | 'password-mismatch'
  | 'invalid-key'
  | 'vault-changed'
  | 'vault-missing'
  | 'crypto-unavailable'
  | 'storage-failed'
  | 'env-not-set'
  | 'env-unavailable'
  | 'env-not-named';

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
  'env-not-set': 'The environment variable is not set.',
  'env-unavailable': 'Could not read the environment.',
  'env-not-named': 'Add an environment variable name in Settings > Keys.',
};

export function keyFailure(code: KeyErrorCode): { ok: false; error: KeyError } {
  return { ok: false, error: { code, message: MESSAGES[code] } };
}

// Api-keys R17: a variable that is not set is named in the message (a name is not a secret, a value never appears).
export function envNotSetFailure(name: string): { ok: false; error: KeyError } {
  return { ok: false, error: { code: 'env-not-set', message: `"${name}" is not set.` } };
}

export const KEY_OK: KeyResult<void> = { ok: true, value: undefined };
