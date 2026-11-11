import { isPlainSetId } from '../records/blobKeys';
import { isSafeBlobKey } from '../records/projectRecords';

// The shape of an exported project zip (specs/app/projects/contracts.md, Zip contract).
export const MANIFEST_PATH = 'manifest.json';
export const PROJECT_PATH = 'project.json';
export const TILES_PATH = 'brushTiles.bin';
export const APP_NAME = 'texture-lab';

export const ZIP_LIMITS = { maxEntries: 5000, maxBlobBytes: 512 * 1024 * 1024, maxRecordBytes: 64 * 1024 * 1024 } as const;

export interface ExportManifest {
  app: string; // APP_NAME, or the name for an appId
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
