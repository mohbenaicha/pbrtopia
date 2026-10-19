import { PROVIDERS, VAULT_VERSION, type SealedKey, type VaultRecord } from './vaultTypes';
import { IV_BYTES, SALT_BYTES, type SealedBytes } from './crypto/sealedBytes';

const isObject = (value: unknown): value is Record<string, unknown> => typeof value === 'object' && value !== null && !Array.isArray(value);

function readSealedBytes(value: unknown): SealedBytes | null {
  if (!isObject(value)) return null;
  const { iv, ciphertext } = value;
  if (!(iv instanceof Uint8Array) || iv.length !== IV_BYTES || !(ciphertext instanceof Uint8Array)) return null;
  return { iv: new Uint8Array(iv), ciphertext: new Uint8Array(ciphertext) };
}

function readSealedKey(value: unknown): SealedKey | null {
  const sealed = readSealedBytes(value);
  if (!sealed || !isObject(value)) return null;
  const { hint, addedAt } = value;
  if (typeof hint !== 'string' || typeof addedAt !== 'string') return null;
  return { ...sealed, hint, addedAt };
}

// The vault record from what was stored, or null when it is not a whole version-1 record. Only the data model's fields are kept
// (a key for an unknown provider is dropped); the bytes are copied so the caller owns them.
export function readVaultRecord(raw: unknown): VaultRecord | null {
  if (!isObject(raw) || raw['version'] !== VAULT_VERSION) return null;
  const { revision, kdf, keys } = raw;
  if (typeof revision !== 'number' || !Number.isInteger(revision) || revision < 1) return null;
  if (!isObject(kdf) || kdf['name'] !== 'PBKDF2' || kdf['hash'] !== 'SHA-256') return null;
  const { iterations, salt } = kdf;
  if (typeof iterations !== 'number' || !Number.isInteger(iterations) || iterations < 1) return null;
  if (!(salt instanceof Uint8Array) || salt.length !== SALT_BYTES) return null;
  const verifier = readSealedBytes(raw['verifier']);
  if (!verifier || !isObject(keys)) return null;
  const record: VaultRecord = { version: VAULT_VERSION, revision, kdf: { name: 'PBKDF2', hash: 'SHA-256', iterations, salt: new Uint8Array(salt) }, verifier, keys: {} };
  for (const provider of PROVIDERS) {
    if (keys[provider] === undefined) continue;
    const sealed = readSealedKey(keys[provider]);
    if (!sealed) return null;
    record.keys[provider] = sealed;
  }
  return record;
}
