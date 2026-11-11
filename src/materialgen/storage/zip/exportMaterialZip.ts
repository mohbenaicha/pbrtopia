import {
  MANIFEST_PATH, PROJECT_PATH, blobEntryPath, encodeJsonBytes, isDeflatable, storeFailure, streamZipEntries,
  type StoreResult, type ZipFileEntry,
} from '@shared/projects';
import type { MaterialProjectStore } from '../MaterialProjectStore';
import { referencedBlobKeys } from '../materialRecord';
import { THUMBNAIL_ENTRY_KEY, newMaterialManifest } from './materialManifest';

export type MaterialExportSource = Pick<MaterialProjectStore, 'loadProject' | 'readBlob' | 'loadThumbnail'>;

async function planEntries(source: MaterialExportSource, projectId: string, appId: string): Promise<StoreResult<ZipFileEntry[]>> {
  const loaded = await source.loadProject(projectId);
  if (!loaded.ok) return loaded;
  const record = { ...loaded.value };
  const hadThumbnail = record.thumbnailKey !== undefined;
  delete record.thumbnailKey; // the zip carries the picture itself; import stores it again
  delete record.partlyDeleted;
  const entries: ZipFileEntry[] = [];
  const addBytes = (path: string, content: Uint8Array): void => void entries.push({ path, size: content.byteLength, deflate: true, content });
  addBytes(PROJECT_PATH, encodeJsonBytes(record));
  for (const key of [...referencedBlobKeys(loaded.value)].sort()) {
    const blob = await source.readBlob(projectId, key);
    if (blob === null) return storeFailure('not-found', `The project's file "${key}" is missing, so it cannot be exported.`);
    entries.push({ path: blobEntryPath(key), size: blob.size, deflate: isDeflatable(key), content: blob });
  }
  const thumbnail = hadThumbnail ? await source.loadThumbnail(projectId) : null;
  if (thumbnail !== null) entries.push({ path: blobEntryPath(THUMBNAIL_ENTRY_KEY), size: thumbnail.size, deflate: false, content: thumbnail });
  const manifest = newMaterialManifest(appId, projectId, record.name, entries.map((entry) => ({ path: entry.path, bytes: entry.size })));
  return { ok: true, value: [{ path: MANIFEST_PATH, size: 0, deflate: true, content: encodeJsonBytes(manifest) }, ...entries] };
}

/**
 * Streams the project as a zip into `sink`: manifest, record, every file the record references once, then the thumbnail (app R37).
 * `onProgress(done, total)` counts entries including the manifest. A missing file fails the export and says which.
 */
export async function exportMaterialZip(source: MaterialExportSource, projectId: string, sink: WritableStream<Uint8Array>, onProgress: ((done: number, total: number) => void) | undefined, options: { appId: string }): Promise<StoreResult<void>> {
  const planned = await planEntries(source, projectId, options.appId).catch(() => storeFailure('aborted', "The project's files could not be read."));
  if (!planned.ok) {
    await sink.abort().catch(() => undefined); // a file the user picked would otherwise stay open
    return planned;
  }
  return streamZipEntries(planned.value, sink, onProgress);
}
