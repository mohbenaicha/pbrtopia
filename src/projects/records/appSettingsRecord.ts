import { isRawRecord, type RawRecord } from './fieldReaders';
import { CURRENT_SCHEMA_VERSION } from './projectRecords';

interface EnhancerChoiceRecord {
  provider: 'gemini' | 'openai';
  modelId: string;
}

// The model list last fetched from the providers. Entries are generation's ProviderModelRecord; `projects/` keeps them as stored.
export interface CatalogCacheRecord {
  fetchedAt: string;
  gemini: Record<string, unknown>[];
  openai: Record<string, unknown>[];
}

// App-wide settings. `viewport` is the viewport's own settings object, kept as stored and clamped by `app/` when used.
export interface AppSettingsRecord {
  schemaVersion: number;
  lastOpenProjectId: string | null;
  enhancer: EnhancerChoiceRecord | null;
  catalog: CatalogCacheRecord | null;
  viewport: Record<string, unknown>;
}

export const DEFAULT_APP_SETTINGS: AppSettingsRecord = { schemaVersion: CURRENT_SCHEMA_VERSION, lastOpenProjectId: null, enhancer: null, catalog: null, viewport: {} };

const nonEmptyText = (value: unknown): string | null => (typeof value === 'string' && value !== '' ? value : null);

function readEnhancer(value: unknown): EnhancerChoiceRecord | null {
  if (!isRawRecord(value)) return null;
  const modelId = nonEmptyText(value['modelId']);
  const provider = value['provider'];
  return modelId !== null && (provider === 'gemini' || provider === 'openai') ? { provider, modelId } : null;
}

const readModelEntries = (value: unknown): Record<string, unknown>[] | null => (Array.isArray(value) ? value.filter(isRawRecord) : null);

function readCatalog(value: unknown): CatalogCacheRecord | null {
  if (!isRawRecord(value)) return null;
  const fetchedAt = value['fetchedAt'];
  const gemini = readModelEntries(value['gemini']);
  const openai = readModelEntries(value['openai']);
  if (typeof fetchedAt !== 'string' || Number.isNaN(Date.parse(fetchedAt)) || gemini === null || openai === null) return null;
  return { fetchedAt, gemini: structuredClone(gemini), openai: structuredClone(openai) };
}

/** Reads stored settings leniently: every part that is missing or wrong falls back to its default, so settings never block the app. */
export function readAppSettings(raw: unknown): AppSettingsRecord {
  const stored: RawRecord = isRawRecord(raw) ? raw : {};
  return {
    schemaVersion: CURRENT_SCHEMA_VERSION,
    lastOpenProjectId: nonEmptyText(stored['lastOpenProjectId']),
    enhancer: readEnhancer(stored['enhancer']),
    catalog: readCatalog(stored['catalog']),
    viewport: isRawRecord(stored['viewport']) ? structuredClone(stored['viewport']) : {},
  };
}
