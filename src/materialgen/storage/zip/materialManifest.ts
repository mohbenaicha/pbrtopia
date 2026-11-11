import { projectStoreNames } from '@shared/appId';
import { ZIP_LIMITS, parseJsonEntry, reject, type ZipEntry } from '@shared/projects';

// The first entry of a material project zip (app R37).

export const THUMBNAIL_ENTRY_KEY = 'thumbnail.jpg'; // stored as `blobs/thumbnail.jpg`; not a file of the project
export const NOT_A_MATERIAL_PROJECT = 'This is not a material project.';
/** The zip layout's own version (app R37), kept apart from the record's schema version: they change for different reasons. */
export const MATERIAL_ZIP_FORMAT_VERSION = 1;

export interface MaterialManifest {
  app: string; // the zip name of the exporting app's `appId`
  formatVersion: number;
  exportedAt: string;
  projectId: string;
  projectName: string;
  files: { path: string; bytes: number }[]; // every entry after the manifest, in order
}

export function newMaterialManifest(appId: string, projectId: string, projectName: string, files: MaterialManifest['files']): MaterialManifest {
  return { app: projectStoreNames(appId).zipApp, formatVersion: MATERIAL_ZIP_FORMAT_VERSION, exportedAt: new Date().toISOString(), projectId, projectName, files };
}

/** Reads and checks the manifest entry: this app's zip, a version this app reads, and a file list that is well formed. */
export function readMaterialManifest(entry: ZipEntry, appId: string): MaterialManifest {
  const raw = parseJsonEntry(entry);
  if (raw['app'] !== projectStoreNames(appId).zipApp) reject(NOT_A_MATERIAL_PROJECT);
  const version = raw['formatVersion'];
  if (typeof version !== 'number' || !Number.isInteger(version) || version < 1) reject("The zip's manifest has no valid version.");
  if ((version as number) > MATERIAL_ZIP_FORMAT_VERSION) reject('This zip was made by a newer version.', 'schema-too-new');
  const files = raw['files'];
  if (typeof raw['projectId'] !== 'string' || typeof raw['projectName'] !== 'string' || !Array.isArray(files) || files.length > ZIP_LIMITS.maxEntries) reject("The zip's manifest is damaged.");
  for (const file of files as unknown[]) {
    const item = file as Record<string, unknown> | null;
    if (typeof item !== 'object' || item === null || typeof item['path'] !== 'string' || typeof item['bytes'] !== 'number' || !Number.isInteger(item['bytes']) || item['bytes'] < 0) reject("The zip's manifest is damaged.");
  }
  return raw as unknown as MaterialManifest;
}
