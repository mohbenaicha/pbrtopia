import type { VaultRecord } from '../../src/keys/vaultTypes';

const bytes = (length: number, seed: number): Uint8Array => Uint8Array.from({ length }, (_, i) => (i * 7 + seed) % 256);

// A valid stored vault with both providers' keys; the bytes are arbitrary, nothing here is decrypted.
export function sampleVaultRecord(overrides: Partial<VaultRecord> = {}): VaultRecord {
  return {
    version: 1,
    revision: 3,
    kdf: { name: 'PBKDF2', hash: 'SHA-256', iterations: 1000, salt: bytes(16, 1) },
    verifier: { iv: bytes(12, 2), ciphertext: bytes(40, 3) },
    keys: {
      gemini: { iv: bytes(12, 4), ciphertext: bytes(48, 5), hint: 'abcd', addedAt: '2026-10-18T10:00:00.000Z' },
      openai: { iv: bytes(12, 6), ciphertext: bytes(52, 7), hint: 'wxyz', addedAt: '2026-10-18T11:00:00.000Z' },
    },
    ...overrides,
  };
}
