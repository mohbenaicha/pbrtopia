import { readVaultRecord } from './readVaultRecord';
import type { VaultRecord, VaultStorage } from './vaultTypes';

export const VAULT_DATABASE_NAME = 'texture-lab-keys';
const STORE = 'vault';
const KEY = 'vault';

const UNAVAILABLE = 'This browser cannot store keys.';
const UNREADABLE = 'The key vault could not be read.';
const FAILED = 'The key vault could not be saved.';

const settle = <T>(request: IDBRequest<T>): Promise<T> =>
  new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });

function openVaultDatabase(factory: IDBFactory): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = factory.open(VAULT_DATABASE_NAME, 1);
    request.onupgradeneeded = () => request.result.createObjectStore(STORE);
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

const sameBytes = (a: Uint8Array, b: Uint8Array): boolean => a.length === b.length && a.every((value, i) => value === b[i]);

// R2, R5, R10: the vault record in its own IndexedDB database. Each call opens the database and closes it again, so a handle never goes
// stale when another tab upgrades it. Failures are rejected with fixed messages, never with stored content.
export function createIndexedDbVaultStorage(factory: IDBFactory | null = globalThis.indexedDB ?? null): VaultStorage {
  async function withStore<T>(mode: IDBTransactionMode, failure: string, work: (store: IDBObjectStore) => Promise<T>): Promise<T> {
    if (!factory) throw new Error(UNAVAILABLE);
    let db: IDBDatabase;
    try {
      db = await openVaultDatabase(factory);
    } catch {
      throw new Error(UNAVAILABLE);
    }
    try {
      const tx = db.transaction(STORE, mode);
      const finished = new Promise<void>((resolve, reject) => {
        tx.oncomplete = () => resolve();
        tx.onabort = () => reject(tx.error);
      });
      finished.catch(() => undefined);
      const value = await work(tx.objectStore(STORE)); // awaits only this transaction's requests, so the browser keeps it open
      await finished;
      return value;
    } catch {
      throw new Error(failure);
    } finally {
      db.close();
    }
  }

  return {
    async load() {
      const raw = await withStore('readonly', UNREADABLE, (store) => settle(store.get(KEY)));
      if (raw === undefined) return null;
      const record = readVaultRecord(raw);
      if (!record) throw new Error(UNREADABLE);
      return record;
    },

    async save(record: VaultRecord, basedOnRevision) {
      return withStore('readwrite', FAILED, async (store) => {
        const raw = await settle(store.get(KEY));
        const current = readVaultRecord(raw);
        // "No vault yet" is only true when nothing at all is stored: a record that cannot be read is still somebody's vault.
        const stale = basedOnRevision === null ? raw !== undefined : current === null || current.revision !== basedOnRevision || !sameBytes(current.kdf.salt, record.kdf.salt);
        if (stale) return 'conflict' as const;
        await settle(store.put(readVaultRecord(record) ?? failNow(), KEY));
        return 'saved' as const;
      });
    },

    async clear() {
      await withStore('readwrite', FAILED, (store) => settle(store.delete(KEY)));
    },
  };
}

function failNow(): never {
  throw new Error(FAILED);
}
