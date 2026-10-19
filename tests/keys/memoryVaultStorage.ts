import type { VaultRecord, VaultStorage } from '../../src/keys/vaultTypes';

// The in-memory stand-in for the vault storage used by KeyVault tests. It follows the same contract as the IndexedDB one
// (tests/keys/vaultStorageContract.ts runs the same checks on both), and keeps copies so callers cannot change what is stored.
export function createMemoryVaultStorage(): VaultStorage & { peek(): VaultRecord | null } {
  let stored: VaultRecord | null = null;
  return {
    async load() {
      return stored ? structuredClone(stored) : null;
    },
    async save(record, basedOnRevision) {
      if (basedOnRevision === null ? stored !== null : stored === null || stored.revision !== basedOnRevision || !sameBytes(stored.kdf.salt, record.kdf.salt)) return 'conflict';
      stored = structuredClone(record);
      return 'saved';
    },
    async clear() {
      stored = null;
    },
    peek: () => (stored ? structuredClone(stored) : null),
  };
}

const sameBytes = (a: Uint8Array, b: Uint8Array): boolean => a.length === b.length && a.every((value, i) => value === b[i]);
