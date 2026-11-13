import {
  MANIFEST_PATH, PROJECT_PATH, blobEntryPath, encodeJsonBytes, isDeflatable, storeFailure, streamZipEntries,
  type StoreResult, type ZipFileEntry,
} from '@shared/projects';
import type { MapKind } from '@mat/maps';
import type { MaterialProjectStore } from '../MaterialProjectStore';
import { referencedBlobKeys, type MapRecord, type MapUndoEntry, type MaterialRecord } from '../materialRecord';
import { THUMBNAIL_ENTRY_KEY, newMaterialManifest } from './materialManifest';

export type MaterialExportSource = Pick<MaterialProjectStore, 'loadProject' | 'readBlob' | 'loadThumbnail'>;

/** What an export tells besides its file (app R37): the Height offsets' base was missing, so the Height map went out as it is. */
export interface MaterialExportOutcome {
  droppedHeightBase: boolean;
}

export const DROPPED_HEIGHT_BASE_NOTE = "The Height offsets' base file was missing, so the Height map is exported as it is.";

/** The keys only the Height offsets' base tags name: losing one never loses a map (masks R83 falls back to the working Height). */
function heightBaseOnlyKeys(record: MaterialRecord): Set<string> {
  const held = new Set<string>(record.referenceImages);
  for (const map of Object.values(record.maps)) for (const key of [map.originalKey, map.workingKey, map.undoKey]) if (key !== null) held.add(key);
  const bases = new Set<string>();
  for (const map of Object.values(record.maps)) for (const key of [map.offsetBase, map.undo?.offsetBase]) if (key !== undefined && !held.has(key)) bases.add(key);
  return bases;
}

/** The record without the tags that name a base that is not in the zip. */
function withoutTags(record: MaterialRecord, missing: ReadonlySet<string>): MaterialRecord {
  const maps: MaterialRecord['maps'] = {};
  for (const [kind, map] of Object.entries(record.maps) as [MapKind, MapRecord][]) {
    const next: MapRecord = { ...map };
    if (next.offsetBase !== undefined && missing.has(next.offsetBase)) delete next.offsetBase;
    if (next.undo?.offsetBase !== undefined && missing.has(next.undo.offsetBase)) next.undo = Object.fromEntries(Object.entries(next.undo).filter(([field]) => field !== 'offsetBase')) as MapUndoEntry;
    maps[kind] = next;
  }
  return { ...record, maps };
}

async function planEntries(source: MaterialExportSource, projectId: string, appId: string): Promise<StoreResult<{ entries: ZipFileEntry[]; outcome: MaterialExportOutcome }>> {
  const loaded = await source.loadProject(projectId);
  if (!loaded.ok) return loaded;
  const baseOnly = heightBaseOnlyKeys(loaded.value);
  const missingBases = new Set<string>();
  const blobEntries: ZipFileEntry[] = [];
  for (const key of [...referencedBlobKeys(loaded.value)].sort()) {
    const blob = await source.readBlob(projectId, key);
    if (blob === null) {
      if (baseOnly.has(key)) {
        missingBases.add(key);
        continue;
      }
      return storeFailure('not-found', `The project's file "${key}" is missing, so it cannot be exported.`);
    }
    blobEntries.push({ path: blobEntryPath(key), size: blob.size, deflate: isDeflatable(key), content: blob });
  }
  const record = withoutTags(loaded.value, missingBases);
  const hadThumbnail = record.thumbnailKey !== undefined;
  delete record.thumbnailKey; // the zip carries the picture itself; import stores it again
  delete record.partlyDeleted;
  const recordBytes = encodeJsonBytes(record);
  const entries: ZipFileEntry[] = [{ path: PROJECT_PATH, size: recordBytes.byteLength, deflate: true, content: recordBytes }, ...blobEntries];
  const thumbnail = hadThumbnail ? await source.loadThumbnail(projectId) : null;
  if (thumbnail !== null) entries.push({ path: blobEntryPath(THUMBNAIL_ENTRY_KEY), size: thumbnail.size, deflate: false, content: thumbnail });
  const manifest = newMaterialManifest(appId, projectId, record.name, entries.map((entry) => ({ path: entry.path, bytes: entry.size })));
  return { ok: true, value: { entries: [{ path: MANIFEST_PATH, size: 0, deflate: true, content: encodeJsonBytes(manifest) }, ...entries], outcome: { droppedHeightBase: missingBases.size > 0 } } };
}

/**
 * Streams the project as a zip into `sink`: manifest, record, every file the record references once, then the thumbnail (app R37).
 * `onProgress(done, total)` counts entries including the manifest. A missing file fails the export and says which, except the Height offsets' base (see R37).
 */
export async function exportMaterialZip(source: MaterialExportSource, projectId: string, sink: WritableStream<Uint8Array>, onProgress: ((done: number, total: number) => void) | undefined, options: { appId: string }): Promise<StoreResult<MaterialExportOutcome>> {
  const planned = await planEntries(source, projectId, options.appId).catch(() => storeFailure('aborted', "The project's files could not be read."));
  if (!planned.ok) {
    await sink.abort().catch(() => undefined); // a file the user picked would otherwise stay open
    return planned;
  }
  const streamed = await streamZipEntries(planned.value.entries, sink, onProgress);
  return streamed.ok ? { ok: true, value: planned.value.outcome } : streamed;
}
