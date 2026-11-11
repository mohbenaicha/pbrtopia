import { projectStoreNames } from '../../appId';
import { storeFailure, type StoreResult } from '../storeError';
import { checkBlobAddress, checkProjectId, isSafeProjectId, storeOk, type BlobStore } from './BlobStore';

const isNamed = (error: unknown, ...names: string[]): boolean => error instanceof DOMException && names.includes(error.name);

function writeFailure(error: unknown): StoreResult<void> {
  if (isNamed(error, 'QuotaExceededError')) return storeFailure('quota-exceeded', 'There is no room left to save this file. Free up space or export your projects.');
  return storeFailure('storage-unavailable', 'The browser would not save this file.');
}

// Folder handle for the app's blobs inside the browser's private file system (OPFS); the folder is named for `appId` when one is given.
export async function openOpfsRoot(appId?: string, getOrigin: () => Promise<FileSystemDirectoryHandle> = () => navigator.storage.getDirectory()): Promise<FileSystemDirectoryHandle> {
  const folder = projectStoreNames(appId).folder;
  const origin = await getOrigin();
  return origin.getDirectoryHandle(folder, { create: true });
}

// BlobStore over OPFS: `<root>/<projectId>/<key>`, with the key's folders created as needed.
export function createOpfsBlobStore(root: FileSystemDirectoryHandle): BlobStore {
  async function findFolder(projectId: string, folders: string[], create: boolean): Promise<FileSystemDirectoryHandle | null> {
    try {
      let folder = await root.getDirectoryHandle(projectId, { create });
      for (const name of folders) folder = await folder.getDirectoryHandle(name, { create });
      return folder;
    } catch (error) {
      if (isNamed(error, 'NotFoundError', 'TypeMismatchError')) return null;
      throw error;
    }
  }

  async function collectKeys(folder: FileSystemDirectoryHandle, path: string, into: string[]): Promise<void> {
    for await (const [name, entry] of folder.entries()) {
      if (entry.kind === 'directory') await collectKeys(entry as FileSystemDirectoryHandle, `${path}${name}/`, into);
      else into.push(`${path}${name}`);
    }
  }

  return {
    async put(projectId, key, blob) {
      const bad = checkBlobAddress(projectId, key);
      if (!bad.ok) return bad;
      const parts = key.split('/');
      const fileName = parts.pop() as string;
      try {
        const folder = await findFolder(projectId, parts, true);
        if (!folder) return storeFailure('storage-unavailable', 'The browser would not save this file.');
        let created = false;
        let file: FileSystemFileHandle;
        try {
          file = await folder.getFileHandle(fileName);
        } catch (error) {
          if (!isNamed(error, 'NotFoundError')) throw error;
          file = await folder.getFileHandle(fileName, { create: true });
          created = true;
        }
        try {
          const writable = await file.createWritable();
          try {
            await writable.write(blob);
            await writable.close(); // the old contents are replaced only here, so a failed write keeps them
          } catch (error) {
            await writable.abort().catch(() => undefined);
            throw error;
          }
        } catch (error) {
          if (created) await folder.removeEntry(fileName).catch(() => undefined); // a failed put to a new key leaves no empty file
          throw error;
        }
        return storeOk;
      } catch (error) {
        return writeFailure(error);
      }
    },
    async get(projectId, key) {
      if (!checkBlobAddress(projectId, key).ok) return null;
      const parts = key.split('/');
      const fileName = parts.pop() as string;
      try {
        const folder = await findFolder(projectId, parts, false);
        if (!folder) return null;
        return await (await folder.getFileHandle(fileName)).getFile();
      } catch (error) {
        if (isNamed(error, 'NotFoundError', 'TypeMismatchError')) return null;
        throw error;
      }
    },
    async delete(projectId, key) {
      const bad = checkBlobAddress(projectId, key);
      if (!bad.ok) return bad;
      const parts = key.split('/');
      const fileName = parts.pop() as string;
      try {
        const folder = await findFolder(projectId, parts, false);
        await folder?.removeEntry(fileName);
        return storeOk;
      } catch (error) {
        return isNamed(error, 'NotFoundError', 'TypeMismatchError') ? storeOk : writeFailure(error);
      }
    },
    async deleteProject(projectId) {
      const bad = checkProjectId(projectId);
      if (!bad.ok) return bad;
      try {
        await root.removeEntry(projectId, { recursive: true });
        return storeOk;
      } catch (error) {
        return isNamed(error, 'NotFoundError') ? storeOk : writeFailure(error);
      }
    },
    async list(projectId, prefix = '') {
      if (!isSafeProjectId(projectId)) return [];
      const folder = await findFolder(projectId, [], false);
      if (!folder) return [];
      const keys: string[] = [];
      await collectKeys(folder, '', keys);
      return keys.filter((key) => key.startsWith(prefix)).sort();
    },
  };
}
