import { storeFailure, type StoreErrorCode, type StoreResult } from '../storeError';
import { checkBlobAddress, checkProjectId, isSafeProjectId, storeOk, type BlobStore } from './BlobStore';

export interface MemoryBlobStore extends BlobStore {
  /** Makes the next put, delete or deleteProject fail with this code and change nothing (tests only). */
  failNextWrite(code: StoreErrorCode): void;
}

// In-memory BlobStore for tests and for running the app against a fake.
export function createMemoryBlobStore(): MemoryBlobStore {
  const blobs = new Map<string, Blob>();
  let injected: StoreErrorCode | null = null;
  const addressOf = (projectId: string, key: string): string => `${projectId}/${key}`;

  const takeInjectedFailure = (): StoreResult<void> | null => {
    if (injected === null) return null;
    const code = injected;
    injected = null;
    return storeFailure(code, 'The write was refused (simulated).');
  };

  return {
    failNextWrite(code) {
      injected = code;
    },
    async put(projectId, key, blob) {
      const bad = checkBlobAddress(projectId, key);
      if (!bad.ok) return bad;
      const refused = takeInjectedFailure();
      if (refused) return refused;
      blobs.set(addressOf(projectId, key), blob.slice());
      return storeOk;
    },
    async get(projectId, key) {
      if (!checkBlobAddress(projectId, key).ok) return null;
      return blobs.get(addressOf(projectId, key)) ?? null;
    },
    async delete(projectId, key) {
      const bad = checkBlobAddress(projectId, key);
      if (!bad.ok) return bad;
      const refused = takeInjectedFailure();
      if (refused) return refused;
      blobs.delete(addressOf(projectId, key));
      return storeOk;
    },
    async deleteProject(projectId) {
      const bad = checkProjectId(projectId);
      if (!bad.ok) return bad;
      const refused = takeInjectedFailure();
      if (refused) return refused;
      for (const address of [...blobs.keys()]) if (address.startsWith(`${projectId}/`)) blobs.delete(address);
      return storeOk;
    },
    async list(projectId, prefix = '') {
      if (!isSafeProjectId(projectId)) return [];
      const folder = `${projectId}/`;
      return [...blobs.keys()]
        .filter((address) => address.startsWith(folder))
        .map((address) => address.slice(folder.length))
        .filter((key) => key.startsWith(prefix))
        .sort();
    },
  };
}
