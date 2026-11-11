import 'fake-indexeddb/auto';
import { IDBFactory } from 'fake-indexeddb';
import { createMemoryBlobStore, type MemoryBlobStore } from '@shared/projects/storage/memoryBlobStore';
import { createMaterialStore } from '@mat/storage/createMaterialStore';
import { openMaterialDatabase, type MaterialDatabase } from '@mat/storage/materialDatabase';
import type { MaterialProjectStore } from '@mat/storage/MaterialProjectStore';

export interface TestMaterialStore {
  store: MaterialProjectStore;
  blobs: MemoryBlobStore;
  database: MaterialDatabase;
  factory: IDBFactory;
  /** Moves the store's clock forward. */
  advance(seconds: number): void;
}

// A store on a fresh fake IndexedDB and in-memory blobs, with ids `id-1`, `id-2`, ... and a clock the test moves.
export async function createTestMaterialStore(appId = 'material-lab', factory: IDBFactory = new IDBFactory()): Promise<TestMaterialStore> {
  const opened = await openMaterialDatabase(factory, appId);
  if (!opened.ok) throw new Error(opened.error.message);
  const blobs = createMemoryBlobStore();
  let counter = 0;
  let time = Date.parse('2026-11-10T09:00:00.000Z');
  const store = createMaterialStore({ database: opened.value, blobs, newId: () => `id-${++counter}`, now: () => new Date(time) });
  return { store, blobs, database: opened.value, factory, advance: (seconds) => void (time += seconds * 1000) };
}

export const png = (...values: number[]): Blob => new Blob([new Uint8Array(values)], { type: 'image/png' });
