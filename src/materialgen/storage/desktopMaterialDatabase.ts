import { StoreAbort, storeFailure } from '@shared/projects';
import { bytesToThumbnail, decodeJsonOr, encodeJsonRecord, thumbnailToBytes, type DesktopRecordEngine, type EngineTransaction } from '@shared/storage-desktop';
import type { MaterialDatabase, MaterialTransaction } from './materialDatabase';
import type { MaterialRecord } from './materialRecord';

// Storage-backends R5: the material app's database on the desktop record store; a drop-in for the IndexedDB one.

const asProject = (key: string, bytes: Uint8Array): unknown => decodeJsonOr(bytes, () => ({ id: key }));

function wrapTransaction(tx: EngineTransaction): MaterialTransaction {
  const transaction = {
    async get(store: string, key: string) {
      const bytes = await tx.get(store, key);
      if (bytes === null) return undefined;
      if (store === 'projects') return asProject(key, bytes);
      if (store === 'thumbnails') return bytesToThumbnail(bytes);
      return decodeJsonOr(bytes, () => ({}));
    },
    async putProject(record: MaterialRecord) {
      const updatedAt = (record as unknown as { updatedAt?: unknown }).updatedAt;
      if (typeof record.id !== 'string') throw new StoreAbort(storeFailure('corrupt', 'A material project had no id.').error);
      await tx.put('projects', record.id, encodeJsonRecord(record), { sort: typeof updatedAt === 'string' ? updatedAt : '' });
    },
    async putAt(store: string, key: string, value: Blob | Record<string, unknown>) {
      await tx.put(store, key, store === 'thumbnails' ? await thumbnailToBytes(value as Blob) : encodeJsonRecord(value));
    },
    async remove(store: string, key: string) {
      await tx.remove(store, key);
    },
    async listProjectsNewestFirst() {
      return (await tx.list('projects', { by: 'sortDescending' })).map((entry) => asProject(entry.key, entry.value));
    },
  };
  return transaction as unknown as MaterialTransaction;
}

export function createDesktopMaterialDatabase(engine: DesktopRecordEngine): MaterialDatabase {
  return {
    close: () => undefined,
    run: (_stores, mode, work) => engine.run(mode, (tx) => work(wrapTransaction(tx))),
  };
}
