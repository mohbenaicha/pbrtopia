import type { KeyResult } from '../../src/keys/keyError';

/** A fake `resolveKey` answer: the key, or the vault-missing failure when there is none. */
export function resolved(key: string | null | undefined): KeyResult<string> {
  if (key === null || key === undefined) return { ok: false, error: { code: 'vault-missing', message: 'There are no saved keys yet.' } };
  return { ok: true, value: key };
}
