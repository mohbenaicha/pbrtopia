import { StoreAbort, isSafeProjectId, parseJsonEntry, reject, shorten, storeFailure, type ZipEntry } from '@shared/projects';
import { hasRoomFor, quotaMessage } from '@mat/maps';
import type { MaterialProjectStore } from '../MaterialProjectStore';
import { referencedBlobKeys, type MaterialRecord } from '../materialRecord';
import { migrateMaterialRecord } from '../readMaterialRecord';
import { THUMBNAIL_ENTRY_KEY, readMaterialManifest, type MaterialManifest } from './materialManifest';

export type MaterialImportTarget = Pick<MaterialProjectStore, 'writeBlob' | 'restoreProject' | 'deleteProjects' | 'saveThumbnail' | 'listProjects'>;

interface ImportPlan {
  referenced: Set<string>;
  received: Set<string>;
  projectId: string;
}

export interface MaterialZipEntryProcessor {
  process(entry: ZipEntry): Promise<void>; // entries one at a time, in zip order
  hasManifest(): boolean;
  isComplete(): boolean; // every entry the manifest lists was processed
  finish(): Promise<{ record: MaterialRecord; thumbnail: Blob | null }>; // rejects when a file the record points to never came
  writtenProjectId(): string | undefined; // the fresh project id once a file was written under it
}

/** Checks each entry against the manifest and the record rules, and writes the files under a fresh project id (app R38). */
export function createMaterialZipEntryProcessor(
  store: Pick<MaterialImportTarget, 'writeBlob'>,
  newId: () => string,
  appId: string,
  onProgress?: (done: number, total: number) => void,
  estimateFreeBytes?: () => Promise<number | null>,
): MaterialZipEntryProcessor {
  let manifest: MaterialManifest | undefined;
  let record: MaterialRecord | undefined;
  let thumbnail: Blob | null = null;
  let processed = 0;
  let plan: ImportPlan | undefined;
  let filesWritten = false;

  function choosePlan(): ImportPlan {
    if (!manifest || !record) return reject('The zip has no project record.');
    if (manifest.projectId !== record.id) reject("The zip's manifest and project record name different projects.");
    return { referenced: referencedBlobKeys(record), received: new Set(), projectId: newId() }; // never the zip's own id: the files are written before the record
  }

  async function process(entry: ZipEntry): Promise<void> {
    const position = processed;
    processed += 1;
    if (entry.kind.kind === 'manifest') {
      manifest = readMaterialManifest(entry, appId);
      if (estimateFreeBytes) {
        // The manifest lists every file's size, so the room is checked on the unzipped size before the first file is written (app R36, maps R67-R69).
        const needed = manifest.files.reduce((sum, file) => sum + file.bytes, 0);
        const free = await estimateFreeBytes().catch(() => null);
        if (!hasRoomFor(needed, free)) throw new StoreAbort(storeFailure('quota-exceeded', quotaMessage(needed, free)).error);
      }
    } else {
      const listed = manifest?.files[position - 1];
      if (listed === undefined || listed.path !== entry.name) reject(`"${shorten(entry.name)}" is not what the zip's manifest lists here.`);
      if (listed!.bytes !== entry.size) reject(`"${shorten(entry.name)}" has a different size than the manifest says.`);
    }
    const kind = entry.kind;
    if (kind.kind === 'project') {
      const loaded = migrateMaterialRecord(parseJsonEntry(entry));
      if (!loaded.ok) throw new StoreAbort(loaded.error);
      if (!isSafeProjectId(loaded.value.id)) reject('The project record has an id that cannot be used.');
      record = loaded.value;
    } else if (kind.kind === 'blob') {
      if (kind.key === THUMBNAIL_ENTRY_KEY) {
        thumbnail = new Blob(entry.chunks as BlobPart[]);
      } else {
        plan ??= choosePlan();
        if (!plan.referenced.has(kind.key)) reject(`The zip has a file the project does not use: "${shorten(kind.key)}".`);
        const written = await store.writeBlob(plan.projectId, kind.key, new Blob(entry.chunks as BlobPart[]));
        filesWritten = true;
        if (!written.ok) throw new StoreAbort(written.error);
        plan.received.add(kind.key);
      }
    } else if (kind.kind !== 'manifest') {
      reject(`"${shorten(entry.name)}" does not belong in a material project.`);
    }
    onProgress?.(processed, 1 + (manifest?.files.length ?? 0));
  }

  return {
    process,
    hasManifest: () => manifest !== undefined && processed > 0,
    isComplete: () => manifest !== undefined && processed === 1 + manifest.files.length,
    async finish() {
      plan ??= choosePlan();
      const missing = [...plan.referenced].sort().find((key) => !plan!.received.has(key));
      if (missing !== undefined) reject(`The zip is missing the file "${shorten(missing)}".`);
      return { record: { ...record!, id: plan.projectId }, thumbnail };
    },
    writtenProjectId: () => (plan && filesWritten ? plan.projectId : undefined),
  };
}
