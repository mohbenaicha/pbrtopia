import { isSafeBlobKey } from '../records/projectRecords';
import { storeFailure, type StoreResult } from '../storeError';

// Large files (model, textures, images) kept per project and addressed by a relative key such as `textures/Body-albedo.png`.
export interface BlobStore {
  put(projectId: string, key: string, blob: Blob): Promise<StoreResult<void>>;
  /** The stored blob, or null when it is not there (or the address is unsafe). */
  get(projectId: string, key: string): Promise<Blob | null>;
  /** Succeeds when the blob is already absent. */
  delete(projectId: string, key: string): Promise<StoreResult<void>>;
  /** Removes every blob of the project; succeeds when there are none. */
  deleteProject(projectId: string): Promise<StoreResult<void>>;
  /** Keys of the project sorted, optionally only those starting with `prefix`. */
  list(projectId: string, prefix?: string): Promise<string[]>;
}

export const storeOk: StoreResult<void> = { ok: true, value: undefined };

// A project id is used as a folder name, so it must be one plain path part.
export const isSafeProjectId = (projectId: string): boolean => isSafeBlobKey(projectId) && !projectId.includes('/');

export function checkProjectId(projectId: string): StoreResult<void> {
  return isSafeProjectId(projectId) ? storeOk : storeFailure('corrupt', `"${projectId}" is not a valid project id.`);
}

export function checkBlobAddress(projectId: string, key: string): StoreResult<void> {
  const project = checkProjectId(projectId);
  if (!project.ok) return project;
  return isSafeBlobKey(key) ? storeOk : storeFailure('corrupt', `"${key}" is not a valid file path.`);
}
