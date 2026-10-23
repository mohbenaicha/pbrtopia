import { CURRENT_SCHEMA_VERSION } from '../records/projectRecords';
import type { ZipEntry } from './readZipEntries';
import { reject, shorten } from './zipRejection';
import { APP_NAME, ZIP_LIMITS, type ExportManifest } from './zipFormat';

export function concatEntryBytes(entry: ZipEntry): Uint8Array {
  const bytes = new Uint8Array(entry.size);
  let at = 0;
  for (const chunk of entry.chunks) {
    bytes.set(chunk, at);
    at += chunk.length;
  }
  return bytes;
}

/** The entry as a JSON object; anything else (bad UTF-8, bad JSON, an array, a number) is a rejection. */
export function parseJsonEntry(entry: ZipEntry): Record<string, unknown> {
  try {
    const value: unknown = JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(concatEntryBytes(entry)));
    if (typeof value === 'object' && value !== null && !Array.isArray(value)) return value as Record<string, unknown>;
  } catch {
    // falls through to the rejection
  }
  return reject(`"${shorten(entry.name)}" in the zip is not readable.`);
}

export function readManifestEntry(entry: ZipEntry): ExportManifest {
  const raw = parseJsonEntry(entry);
  if (raw['app'] !== APP_NAME) reject('This zip was not made by Texture Lab.');
  const version = raw['schemaVersion'];
  if (typeof version !== 'number' || !Number.isInteger(version) || version < 1) reject('The zip\'s manifest has no valid version.');
  if ((version as number) > CURRENT_SCHEMA_VERSION) reject('This zip was made by a newer version of Texture Lab.', 'schema-too-new');
  const files = raw['files'];
  if (typeof raw['projectId'] !== 'string' || !Array.isArray(files) || files.length > ZIP_LIMITS.maxEntries) reject('The zip\'s manifest is damaged.');
  for (const file of files as unknown[]) {
    const item = file as Record<string, unknown> | null;
    if (typeof item !== 'object' || item === null || typeof item['path'] !== 'string' || typeof item['bytes'] !== 'number' || !Number.isInteger(item['bytes']) || item['bytes'] < 0) reject('The zip\'s manifest is damaged.');
  }
  return raw as unknown as ExportManifest;
}
