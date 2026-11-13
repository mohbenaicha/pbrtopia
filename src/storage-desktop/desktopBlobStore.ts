import { isSafeBlobKey, isSafeProjectId, storeFailure, type BlobStore, type StoreResult } from '../projects';
import { storeFailureFromBridge } from './bridgeFailure';
import { MAX_CHUNK_BYTES, type FileBridge } from './FileBridge';
import { caseCollisionWith, escapeKeyPath, escapeSegment, unescapeKeyPath } from './pathEscape';

const OK: StoreResult<void> = { ok: true, value: undefined };

const folderOf = (projectId: string): string => `projects/${escapeSegment(projectId)}/files`;

function checkAddress(projectId: string, key: string): StoreResult<void> {
  if (!isSafeProjectId(projectId)) return storeFailure('corrupt', `"${projectId}" is not a valid project id.`);
  return isSafeBlobKey(key) ? OK : storeFailure('corrupt', `"${key}" is not a valid file path.`);
}

async function collectFiles(files: FileBridge, folder: string, prefix: string, into: string[]): Promise<void> {
  for (const entry of await files.list(folder)) {
    if (entry.kind === 'dir') await collectFiles(files, `${folder}/${entry.name}`, `${prefix}${entry.name}/`, into);
    else into.push(`${prefix}${entry.name}`);
  }
}

/** The existing name, at any level of the key's path under `folder`, that a new name would collide with if only in capitals (storage-backends R6). */
async function findCaseClash(files: FileBridge, folder: string, escapedKey: string): Promise<string | null> {
  let level = folder;
  for (const part of escapedKey.split('/')) {
    const clash = caseCollisionWith((await files.list(level)).map((entry) => entry.name), part);
    if (clash !== null) return clash;
    level = `${level}/${part}`;
  }
  return null;
}

/** Storage-backends R5, R6, R8: BlobStore over the files of the desktop side, `projects/<id>/files/<escaped key>`, written in chunks of at most 8 MB. */
export function createDesktopBlobStore(files: FileBridge): BlobStore {
  return {
    async put(projectId, key, blob) {
      const bad = checkAddress(projectId, key);
      if (!bad.ok) return bad;
      const path = `${folderOf(projectId)}/${escapeKeyPath(key)}`;
      try {
        const clash = await findCaseClash(files, folderOf(projectId), escapeKeyPath(key));
        if (clash !== null) return storeFailure('corrupt', `"${unescapeKeyPath(clash)}" is already stored; names that differ only in capitals cannot both be kept.`);
        const writer = await files.write(path);
        try {
          for (let offset = 0; offset < blob.size; offset += MAX_CHUNK_BYTES) await writer.chunk(new Uint8Array(await blob.slice(offset, offset + MAX_CHUNK_BYTES).arrayBuffer()));
          await writer.commit();
        } catch (error) {
          await writer.abort().catch(() => undefined);
          throw error;
        }
        return OK;
      } catch (error) {
        return storeFailureFromBridge(error);
      }
    },
    async get(projectId, key) {
      if (!checkAddress(projectId, key).ok) return null;
      const chunks = await files.read(`${folderOf(projectId)}/${escapeKeyPath(key)}`);
      if (chunks === null) return null;
      const parts: Uint8Array[] = [];
      for await (const chunk of chunks) parts.push(chunk);
      return new Blob(parts as BlobPart[]);
    },
    async delete(projectId, key) {
      const bad = checkAddress(projectId, key);
      if (!bad.ok) return bad;
      try {
        await files.remove(`${folderOf(projectId)}/${escapeKeyPath(key)}`, false);
        return OK;
      } catch (error) {
        return storeFailureFromBridge(error);
      }
    },
    async deleteProject(projectId) {
      if (!isSafeProjectId(projectId)) return storeFailure('corrupt', `"${projectId}" is not a valid project id.`);
      try {
        await files.remove(`projects/${escapeSegment(projectId)}`, true);
        return OK;
      } catch (error) {
        return storeFailureFromBridge(error);
      }
    },
    async list(projectId, prefix = '') {
      if (!isSafeProjectId(projectId)) return [];
      const found: string[] = [];
      await collectFiles(files, folderOf(projectId), '', found);
      return found.map(unescapeKeyPath).filter((key) => key.startsWith(prefix)).sort();
    },
  };
}
