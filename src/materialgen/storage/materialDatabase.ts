import { projectStoreNames } from '@shared/appId';
import { openRecordDatabase, runRecordTransaction, settle, type StoreResult } from '@shared/projects';
import type { MaterialRecord } from './materialRecord';

// The material app's IndexedDB: three stores only (app R31). Records are stored as written and checked when read.

const DATABASE_VERSION = 1;
/** The one stored settings record; `readMaterialSettings` types it. */
type StoredSettings = Record<string, unknown>;

interface MaterialShapes {
  projects: { key: string; value: MaterialRecord };
  thumbnails: { key: string; value: Blob };
  settings: { key: 'app'; value: StoredSettings };
}
type StoreName = keyof MaterialShapes;

/** Typed reads and writes inside one transaction; await each call before making the next. */
export interface MaterialTransaction {
  get<S extends StoreName>(store: S, key: MaterialShapes[S]['key']): Promise<MaterialShapes[S]['value'] | undefined>;
  putProject(record: MaterialRecord): Promise<void>;
  putAt<S extends 'thumbnails' | 'settings'>(store: S, key: MaterialShapes[S]['key'], value: MaterialShapes[S]['value']): Promise<void>;
  remove<S extends StoreName>(store: S, key: MaterialShapes[S]['key']): Promise<void>;
  listProjectsNewestFirst(): Promise<unknown[]>; // raw: each one is checked by the reader
}

export interface MaterialDatabase {
  /** One transaction: all its writes are kept, or none. The work awaits only the transaction's own calls. */
  run<T>(stores: StoreName[], mode: 'readonly' | 'readwrite', work: (tx: MaterialTransaction) => Promise<T>): Promise<StoreResult<T>>;
  close(): void;
}

function wrapTransaction(tx: IDBTransaction): MaterialTransaction {
  return {
    get: (store, key) => settle(tx.objectStore(store).get(key)),
    putProject: async (record) => void (await settle(tx.objectStore('projects').put(record))),
    putAt: async (store, key, value) => void (await settle(tx.objectStore(store).put(value, key))),
    remove: async (store, key) => void (await settle(tx.objectStore(store).delete(key))),
    listProjectsNewestFirst: async () => (await settle(tx.objectStore('projects').index('updatedAt').getAll())).reverse(),
  };
}

function createStores(db: IDBDatabase): void {
  db.createObjectStore('projects', { keyPath: 'id' }).createIndex('updatedAt', 'updatedAt');
  db.createObjectStore('thumbnails');
  db.createObjectStore('settings');
}

/** Opens (creating on first use) the database named for `appId`. Pass `undefined` as the factory when the browser has no IndexedDB. */
export async function openMaterialDatabase(factory: IDBFactory | undefined, appId: string): Promise<StoreResult<MaterialDatabase>> {
  const opened = await openRecordDatabase(factory, projectStoreNames(appId).database, DATABASE_VERSION, createStores);
  if (!opened.ok) return opened;
  const db = opened.value;
  return { ok: true, value: { close: () => db.close(), run: (stores, mode, work) => runRecordTransaction(db, stores, mode, wrapTransaction, work) } };
}
