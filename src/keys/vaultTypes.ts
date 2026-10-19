import type { SealedBytes } from './crypto/sealedBytes';

export const PROVIDERS = ['gemini', 'openai'] as const;
export type Provider = (typeof PROVIDERS)[number];

export const VAULT_VERSION = 1;

// One provider key as stored: ciphertext and IV, the last 4 characters in plain to tell keys apart, and when it was added.
export interface SealedKey extends SealedBytes {
  hint: string;
  addedAt: string; // ISO time
}

// The one stored record of the key vault. Never holds the password, the derived key or a whole key.
export interface VaultRecord {
  version: typeof VAULT_VERSION;
  revision: number; // 1 when the vault is created, +1 on every save; guards against stale tabs (R10)
  kdf: { name: 'PBKDF2'; hash: 'SHA-256'; iterations: number; salt: Uint8Array };
  verifier: SealedBytes;
  keys: Partial<Record<Provider, SealedKey>>;
}

// Where the vault record lives. `save` is one transaction: 'conflict' (nothing written) when the stored revision or salt differs from
// what the caller based its change on; `basedOnRevision` null means the caller expects no vault yet.
export interface VaultStorage {
  load(): Promise<VaultRecord | null>;
  save(record: VaultRecord, basedOnRevision: number | null): Promise<'saved' | 'conflict'>;
  clear(): Promise<void>;
}
