import { isRawRecord, type RawRecord } from './fieldReaders';
import { CURRENT_SCHEMA_VERSION } from './projectRecords';
import { STORED_PROVIDERS, type StoredProvider } from './storedProviders';

interface EnhancerChoiceRecord {
  provider: StoredProvider;
  modelId: string;
}

// The providers whose model list is fetched and cached. A provider whose models are shipped with the app (OpenRouter, generate R44) is not here:
// its list is always the shipped table, so removing a model never leaves it in a cache.
export const CACHED_PROVIDERS = ['gemini', 'openai'] as const;

// The model list last fetched from the providers. Entries are generation's ProviderModelRecord; `projects/` keeps them as stored.
export interface CatalogCacheRecord {
  fetchedAt: string;
  gemini: Record<string, unknown>[];
  openai: Record<string, unknown>[];
}

// The side panel widths the user dragged to; null is the default width. `app/` clamps them when they are used.
export interface PanelWidthsRecord {
  leftPx: number | null;
  rightPx: number | null;
}

// The longest side, in px, that a picture sent to a provider may have (settings R14, generate R29).
export type ImageMaxPx = 512 | 1024 | 2048;

// App-wide settings. `viewport` is the viewport's own settings object, kept as stored and clamped by `app/` when used.
export interface AppSettingsRecord {
  schemaVersion: number;
  lastOpenProjectId: string | null;
  enhancer: EnhancerChoiceRecord | null;
  enhancerImageMaxPx: ImageMaxPx; // the size cap of the atlas the prompt enhancer sees
  referenceImageMaxPx: ImageMaxPx | null; // the size cap of the references sent to the image model; null = Original size
  catalog: CatalogCacheRecord | null;
  viewport: Record<string, unknown>;
  panels: PanelWidthsRecord;
}

export const DEFAULT_APP_SETTINGS: AppSettingsRecord = {
  schemaVersion: CURRENT_SCHEMA_VERSION,
  lastOpenProjectId: null,
  enhancer: null,
  enhancerImageMaxPx: 1024,
  referenceImageMaxPx: 1024,
  catalog: null,
  viewport: {},
  panels: { leftPx: null, rightPx: null },
};

const nonEmptyText = (value: unknown): string | null => (typeof value === 'string' && value !== '' ? value : null);

function readEnhancer(value: unknown): EnhancerChoiceRecord | null {
  if (!isRawRecord(value)) return null;
  const modelId = nonEmptyText(value['modelId']);
  const provider = value['provider'];
  return modelId !== null && STORED_PROVIDERS.some((name) => name === provider) ? { provider: provider as StoredProvider, modelId } : null;
}

const readImageMaxPx = (value: unknown): ImageMaxPx | null => (value === 512 || value === 1024 || value === 2048 ? value : null);

const readModelEntries = (value: unknown): Record<string, unknown>[] | null => (Array.isArray(value) ? value.filter(isRawRecord) : null);

function readCatalog(value: unknown): CatalogCacheRecord | null {
  if (!isRawRecord(value)) return null;
  const fetchedAt = value['fetchedAt'];
  const gemini = readModelEntries(value['gemini']);
  const openai = readModelEntries(value['openai']);
  if (typeof fetchedAt !== 'string' || Number.isNaN(Date.parse(fetchedAt)) || gemini === null || openai === null) return null;
  return { fetchedAt, gemini: structuredClone(gemini), openai: structuredClone(openai) };
}

const finiteNumberOrNull = (value: unknown): number | null => (typeof value === 'number' && Number.isFinite(value) ? value : null);

function readPanels(value: unknown): PanelWidthsRecord {
  if (!isRawRecord(value)) return { leftPx: null, rightPx: null };
  return { leftPx: finiteNumberOrNull(value['leftPx']), rightPx: finiteNumberOrNull(value['rightPx']) };
}

/** Reads stored settings leniently: every part that is missing or wrong falls back to its default, so settings never block the app. */
export function readAppSettings(raw: unknown): AppSettingsRecord {
  const stored: RawRecord = isRawRecord(raw) ? raw : {};
  return {
    schemaVersion: CURRENT_SCHEMA_VERSION,
    lastOpenProjectId: nonEmptyText(stored['lastOpenProjectId']),
    enhancer: readEnhancer(stored['enhancer']),
    enhancerImageMaxPx: readImageMaxPx(stored['enhancerImageMaxPx']) ?? DEFAULT_APP_SETTINGS.enhancerImageMaxPx,
    referenceImageMaxPx: stored['referenceImageMaxPx'] === null ? null : (readImageMaxPx(stored['referenceImageMaxPx']) ?? DEFAULT_APP_SETTINGS.referenceImageMaxPx),
    catalog: readCatalog(stored['catalog']),
    viewport: isRawRecord(stored['viewport']) ? structuredClone(stored['viewport']) : {},
    panels: readPanels(stored['panels']),
  };
}
