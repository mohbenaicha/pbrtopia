import {
  StoreAbort, THUMBNAIL_MARKER, createOpfsBlobStore, createStorageOperations, isRawRecord, normalizeProjectName, openOpfsRoot, storeFailure,
  type BlobStore, type ProjectSummary, type StorageManagerLike, type StoreError, type StoreResult,
} from '@shared/projects';
import { openMaterialDatabase, type MaterialDatabase, type MaterialTransaction } from './materialDatabase';
import { MATERIAL_SCHEMA_VERSION, newMaterialRecord, referencedBlobKeys, summarizeMaterial, type MaterialRecord } from './materialRecord';
import { readMaterialSettings } from './materialSettings';
import type { MaterialProjectStore } from './MaterialProjectStore';
import { NEWER_VERSION, migrateMaterialRecord } from './readMaterialRecord';

export interface MaterialStoreParts {
  database: MaterialDatabase;
  blobs: BlobStore;
  newId?: () => string;
  now?: () => Date;
  storage?: StorageManagerLike; // the browser's storage manager by default
}

const badName = (): { ok: false; error: StoreError } => storeFailure('corrupt', 'A project name needs 1 to 120 characters.');
const succeeded: StoreResult<void> = { ok: true, value: undefined };

/** Inside database work: the value of a successful result, or stop the work (undoing its writes) with the failure. */
function valueOrAbort<T>(result: StoreResult<T>): T {
  if (!result.ok) throw new StoreAbort(result.error);
  return result.value;
}

async function readOrAbort(tx: MaterialTransaction, id: string): Promise<MaterialRecord> {
  const raw = await tx.get('projects', id);
  if (raw === undefined) throw new StoreAbort(storeFailure('not-found', 'That project no longer exists.').error);
  return valueOrAbort(migrateMaterialRecord(raw));
}

const DAMAGED_RECORD = 'This project is damaged and cannot be opened.';

/** A list row for a project this version cannot open (saved by a newer one, or damaged): it can only be deleted. */
function summarizeUnreadable(raw: unknown, reason: string): ProjectSummary | null {
  if (!isRawRecord(raw) || typeof raw['id'] !== 'string') return null;
  const name = typeof raw['name'] === 'string' && raw['name'].trim() !== '' ? raw['name'] : 'Untitled project';
  return { id: raw['id'], name, updatedAt: typeof raw['updatedAt'] === 'string' ? raw['updatedAt'] : '', unreadable: reason };
}

// The material store, composed from the shared storage primitives (app R30). The projection app's ProjectStore is not involved.
export function createMaterialStore(parts: MaterialStoreParts): MaterialProjectStore {
  const { database, blobs } = parts;
  const newId = parts.newId ?? (() => crypto.randomUUID());
  const stamp = (): string => (parts.now ?? (() => new Date()))().toISOString();
  const storage = parts.storage ?? (typeof navigator === 'undefined' ? undefined : navigator.storage);

  async function deleteOne(id: string): Promise<StoreResult<void>> {
    const removed = await blobs.deleteProject(id); // first: if this fails the project stays listed and can be deleted again
    if (!removed.ok) {
      await database.run(['projects'], 'readwrite', async (tx) => {
        const raw = await tx.get('projects', id);
        if (raw !== undefined) await tx.putProject({ ...raw, partlyDeleted: true });
      });
      return removed;
    }
    return database.run(['projects', 'thumbnails'], 'readwrite', async (tx) => {
      await tx.remove('thumbnails', id);
      await tx.remove('projects', id);
    });
  }

  function validated(record: MaterialRecord): StoreResult<MaterialRecord> {
    return migrateMaterialRecord({ ...structuredClone(record), schemaVersion: MATERIAL_SCHEMA_VERSION });
  }

  return {
    async listProjects() {
      const stored = await database.run(['projects'], 'readonly', (tx) => tx.listProjectsNewestFirst());
      if (!stored.ok) return stored;
      const summaries: ProjectSummary[] = [];
      for (const raw of stored.value) {
        const loaded = migrateMaterialRecord(raw);
        if (loaded.ok) summaries.push(summarizeMaterial(loaded.value));
        else {
          const row = summarizeUnreadable(raw, loaded.error.code === 'schema-too-new' ? NEWER_VERSION : DAMAGED_RECORD); // a record that cannot be read is still listed, so it can be deleted
          if (row) summaries.push(row);
        }
      }
      return { ok: true, value: summaries };
    },

    async createProject(input) {
      const name = normalizeProjectName(input.name);
      if (name === null) return badName();
      const record = newMaterialRecord({ id: newId(), name, size: input.size, now: stamp() });
      const saved = await database.run(['projects'], 'readwrite', (tx) => tx.putProject(record));
      return saved.ok ? { ok: true, value: record } : saved;
    },

    loadProject: (id) => database.run(['projects'], 'readonly', (tx) => readOrAbort(tx, id)),

    saveProject: (record) =>
      database.run(['projects'], 'readwrite', async (tx) => {
        const stored = await readOrAbort(tx, record.id);
        const next = valueOrAbort(validated(record));
        // The name belongs to renameProject: a save queued before a rename must not undo it.
        const merged: MaterialRecord = { ...next, name: stored.name, createdAt: stored.createdAt, updatedAt: stamp() };
        delete merged.thumbnailKey; // the thumbnail marker and the partly-deleted mark belong to the store
        delete merged.partlyDeleted;
        if (stored.thumbnailKey !== undefined) merged.thumbnailKey = stored.thumbnailKey;
        if (stored.partlyDeleted) merged.partlyDeleted = true;
        await tx.putProject(merged);
      }),

    async restoreProject(record) {
      const checked = validated(record);
      if (!checked.ok) return checked;
      const restored: MaterialRecord = { ...checked.value, updatedAt: stamp() };
      delete restored.thumbnailKey; // a restored project has no thumbnail until one is made
      delete restored.partlyDeleted;
      const saved = await database.run(['projects'], 'readwrite', async (tx) => {
        if ((await tx.get('projects', restored.id)) !== undefined) throw new StoreAbort(storeFailure('corrupt', 'A project with this id already exists.').error);
        await tx.putProject(restored);
      });
      return saved.ok ? { ok: true, value: restored } : saved;
    },

    renameProject: (id, newName) =>
      database.run(['projects'], 'readwrite', async (tx) => {
        const stored = await readOrAbort(tx, id);
        const name = normalizeProjectName(newName);
        if (name === null) throw new StoreAbort(badName().error);
        await tx.putProject({ ...stored, name, updatedAt: stamp() });
      }),

    async deleteProjects(ids, onProgress) {
      for (const [index, id] of ids.entries()) {
        const deleted = await deleteOne(id);
        if (!deleted.ok) return deleted;
        onProgress?.(index + 1, ids.length);
      }
      return succeeded;
    },

    saveThumbnail: (projectId, jpeg) =>
      database.run(['projects', 'thumbnails'], 'readwrite', async (tx) => {
        const stored = await readOrAbort(tx, projectId);
        await tx.putAt('thumbnails', projectId, jpeg);
        if (stored.thumbnailKey !== THUMBNAIL_MARKER) await tx.putProject({ ...stored, thumbnailKey: THUMBNAIL_MARKER }); // a new picture does not reorder the list
      }),

    async loadThumbnail(projectId) {
      const found = await database.run(['thumbnails'], 'readonly', (tx) => tx.get('thumbnails', projectId));
      return found.ok ? (found.value ?? null) : null;
    },

    async readBlob(projectId, key) {
      try {
        return await blobs.get(projectId, key);
      } catch {
        return null;
      }
    },

    writeBlob: (projectId, key, blob) => blobs.put(projectId, key, blob),

    deleteBlob: (projectId, key) => blobs.delete(projectId, key),

    async sweepOrphanBlobs(projectId) {
      const loaded = await database.run(['projects'], 'readonly', (tx) => readOrAbort(tx, projectId));
      if (!loaded.ok) return loaded;
      const referenced = referencedBlobKeys(loaded.value);
      let deleted = 0;
      const present = new Set(await blobs.list(projectId)); // listing names the files without reading them (app R12b)
      for (const key of present) {
        if (referenced.has(key)) continue;
        const removed = await blobs.delete(projectId, key);
        if (!removed.ok) return removed;
        deleted += 1;
      }
      const missing = [...referenced].filter((key) => !present.has(key)).sort();
      return { ok: true, value: { deleted, missing } };
    },

    async loadAppSettings() {
      const stored = await database.run(['settings'], 'readonly', (tx) => tx.get('settings', 'app'));
      return readMaterialSettings(stored.ok ? stored.value : undefined);
    },

    saveAppSettings: (patch) =>
      database.run(['settings'], 'readwrite', async (tx) => {
        const current = readMaterialSettings(await tx.get('settings', 'app'));
        await tx.putAt('settings', 'app', { ...readMaterialSettings({ ...current, ...patch }) });
      }),

    ...createStorageOperations(storage),
  };
}

// The real store: IndexedDB for records, OPFS for files, both named for `appId`.
export async function openMaterialStore(appId: string): Promise<StoreResult<MaterialProjectStore>> {
  const database = await openMaterialDatabase(typeof indexedDB === 'undefined' ? undefined : indexedDB, appId);
  if (!database.ok) return database;
  try {
    const blobs = createOpfsBlobStore(await openOpfsRoot(appId));
    return { ok: true, value: createMaterialStore({ database: database.value, blobs }) };
  } catch {
    database.value.close();
    return storeFailure('storage-unavailable', 'This browser cannot keep project files.');
  }
}
