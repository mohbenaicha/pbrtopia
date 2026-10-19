import 'fake-indexeddb/auto';
import { IDBFactory } from 'fake-indexeddb';
import { describe, expect, it } from 'vitest';
import { createIndexedDbVaultStorage, VAULT_DATABASE_NAME } from '../../src/keys/vaultStorage';
import { createMemoryVaultStorage } from './memoryVaultStorage';
import { sampleVaultRecord } from './vaultFixtures';
import { describeVaultStorageContract } from './vaultStorageContract';

describeVaultStorageContract('memory', createMemoryVaultStorage);
describeVaultStorageContract('IndexedDB', () => createIndexedDbVaultStorage(new IDBFactory()));

// Writes straight into the vault database, as another version of the app or a damaged profile might.
async function putRaw(factory: IDBFactory, value: unknown): Promise<void> {
  const db = await new Promise<IDBDatabase>((resolve, reject) => {
    const request = factory.open(VAULT_DATABASE_NAME, 1);
    request.onupgradeneeded = () => request.result.createObjectStore('vault');
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction('vault', 'readwrite');
    tx.objectStore('vault').put(value, 'vault');
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
  db.close();
}

describe('IndexedDB vault storage', () => {
  it('R2 the vault is still there for a new storage object on the same browser database', async () => {
    const factory = new IDBFactory();
    await createIndexedDbVaultStorage(factory).save(sampleVaultRecord({ revision: 1 }), null);
    expect(await createIndexedDbVaultStorage(factory).load()).toEqual(sampleVaultRecord({ revision: 1 }));
  });

  it('R2 the database is called texture-lab-keys and the record holds only the fields of the data model', async () => {
    const factory = new IDBFactory();
    expect(VAULT_DATABASE_NAME).toBe('texture-lab-keys');
    await createIndexedDbVaultStorage(factory).save({ ...sampleVaultRecord({ revision: 1 }), password: 'hunter2', derivedKey: 'x' } as never, null);
    const loaded = (await createIndexedDbVaultStorage(factory).load()) as unknown as Record<string, unknown>;
    expect(Object.keys(loaded).sort()).toEqual(['kdf', 'keys', 'revision', 'verifier', 'version']);
  });

  it('R2 an unreadable stored record fails the load with a fixed message that does not repeat what was stored', async () => {
    for (const damaged of ['not a record', { version: 2 }, { ...sampleVaultRecord(), revision: 0 }, { ...sampleVaultRecord(), kdf: { name: 'PBKDF2', hash: 'SHA-256', iterations: 'many', salt: 'secret-text' } }]) {
      const factory = new IDBFactory();
      await putRaw(factory, damaged);
      const failure = await createIndexedDbVaultStorage(factory).load().then(() => null, (error: Error) => error);
      expect(failure?.message, JSON.stringify(damaged)).toBe('The key vault could not be read.');
    }
  });

  it('R2 a stored key for an unknown provider is dropped when read', async () => {
    const factory = new IDBFactory();
    const record = sampleVaultRecord();
    await putRaw(factory, { ...record, keys: { ...record.keys, claude: record.keys.gemini } });
    expect(Object.keys((await createIndexedDbVaultStorage(factory).load())!.keys).sort()).toEqual(['gemini', 'openai']);
  });

  it('R2 a browser without IndexedDB fails every call with a fixed message', async () => {
    const storage = createIndexedDbVaultStorage(null);
    for (const call of [() => storage.load(), () => storage.save(sampleVaultRecord(), null), () => storage.clear()]) {
      const failure = await call().then(() => null, (error: Error) => error);
      expect(failure?.message).toBe('This browser cannot store keys.');
    }
  });
});
