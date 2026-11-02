import { isPlainSetId } from '../records/blobKeys';
import { isSafeBlobKey, type ProjectRecord } from '../records/projectRecords';
import type { SavedSetRecord } from '../records/savedSetRecord';

// The shape of an exported project zip (specs/app/projects/contracts.md, Zip contract).
export const MANIFEST_PATH = 'manifest.json';
export const PROJECT_PATH = 'project.json';
export const TILES_PATH = 'brushTiles.bin';
export const APP_NAME = 'texture-lab';

export const ZIP_LIMITS = { maxEntries: 5000, maxBlobBytes: 512 * 1024 * 1024, maxRecordBytes: 64 * 1024 * 1024 } as const;

export interface ExportManifest {
  app: typeof APP_NAME;
  schemaVersion: number;
  exportedAt: string;
  projectId: string;
  files: { path: string; bytes: number }[]; // every entry after the manifest, in order
}

export type EntryKind = { kind: 'manifest' } | { kind: 'project' } | { kind: 'tiles' } | { kind: 'set'; setId: string } | { kind: 'blob'; key: string };

export const setRecordPath = (setId: string): string => `sets/${setId}.json`;
export const blobEntryPath = (key: string): string => `blobs/${key}`;

/** What an entry path is for, or null when it is not one of the kinds above or is not a plain relative path. */
export function classifyEntryPath(path: string): EntryKind | null {
  if (path === MANIFEST_PATH) return { kind: 'manifest' };
  if (path === PROJECT_PATH) return { kind: 'project' };
  if (path === TILES_PATH) return { kind: 'tiles' };
  if (path.startsWith('blobs/')) {
    const key = path.slice('blobs/'.length);
    return isSafeBlobKey(key) ? { kind: 'blob', key } : null;
  }
  const set = /^sets\/([^/]+)\.json$/.exec(path);
  if (set && isPlainSetId(set[1]!)) return { kind: 'set', setId: set[1]! };
  return null;
}

/** Every file the records point to, each once: the model, pictures, reference images, and each set's images. */
export function referencedBlobKeys(project: ProjectRecord, sets: readonly SavedSetRecord[]): string[] {
  const keys = new Set<string>([project.modelBlobKey]);
  for (const picture of project.pictures) keys.add(picture.blobKey);
  for (const reference of project.generate.referenceImages) keys.add(reference.blobKey);
  for (const set of sets) for (const image of set.images) keys.add(image.blobKey);
  return [...keys];
}
