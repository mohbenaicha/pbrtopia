import { MAX_FEATHER } from '../bake/bakeMasks';
import { MAX_COMPONENTS } from '../describe/parseComponents';
import type { MaskRow, RowMix } from './maskRows';

/** Masks R10: one palette entry the record keeps for a component. */
export interface PaletteEntry {
  label: number;
  hex: string;
  name: string;
}

/** Masks R41: what the material record keeps of the masks (the pictures are maps; this is everything else). */
export interface MasksRecord {
  source: 'model';
  palette: PaletteEntry[];
  feather: number; // 0 to MAX_FEATHER (R54)
  rows: MaskRow[];
}

export const DEFAULT_FEATHER = 1;

type Raw = Record<string, unknown>;

const isObject = (value: unknown): value is Raw => value !== null && typeof value === 'object' && !Array.isArray(value);
const isUnit = (value: unknown): value is number => typeof value === 'number' && value >= 0 && value <= 1;
const isLabel = (value: unknown, limit: number): value is number => typeof value === 'number' && Number.isInteger(value) && value >= 0 && value < limit;
const isText = (value: unknown): value is string => typeof value === 'string';
const MATCH_KINDS: readonly string[] = ['embedding', 'keyword', 'colour', 'generic'];

function readPalette(value: unknown, limit: number): PaletteEntry[] | null {
  if (!Array.isArray(value) || value.length === 0 || value.length > limit) return null;
  const palette: PaletteEntry[] = [];
  for (const entry of value) {
    if (!isObject(entry) || !isLabel(entry['label'], limit) || !isText(entry['hex']) || !isText(entry['name'])) return null;
    palette.push({ label: entry['label'], hex: entry['hex'], name: entry['name'] });
  }
  return palette;
}

/** Masks R95: the stored Colour mixin of a row; undefined when there is none, null when it is not of the shape `{on, invert, rough, metal}`. */
function readMix(value: unknown): RowMix | undefined | null {
  if (value === undefined) return undefined;
  if (!isObject(value) || typeof value['on'] !== 'boolean' || typeof value['invert'] !== 'boolean' || !isUnit(value['rough']) || !isUnit(value['metal'])) return null;
  return { on: value['on'], invert: value['invert'], rough: value['rough'], metal: value['metal'] };
}

function readRow(value: unknown, labels: ReadonlySet<number>, limit: number): MaskRow | null {
  if (!isObject(value) || !isLabel(value['label'], limit) || !labels.has(value['label'])) return null;
  const texts = ['name', 'description', 'location', 'defaultMaterial', 'material'].every((key) => isText(value[key]));
  if (!texts || !isUnit(value['rough']) || !isUnit(value['metal'])) return null;
  const height = value['height'] === undefined ? 0 : value['height']; // a record from before the height offsets (R88) has none
  if (typeof height !== 'number' || Number.isNaN(height) || height < -1 || height > 1) return null;
  const mix = readMix(value['mix']); // R95: a record from before the mixin has none; one that is not of the shape is not used
  if (mix === null) return null;
  const top3 = Array.isArray(value['top3']) ? value['top3'].filter(isText).slice(0, 3) : [];
  const kind = isText(value['matchKind']) && MATCH_KINDS.includes(value['matchKind']) ? (value['matchKind'] as MaskRow['matchKind']) : 'generic';
  return {
    label: value['label'], name: value['name'] as string, description: value['description'] as string, location: value['location'] as string,
    defaultMaterial: value['defaultMaterial'] as string, top3, matchKind: kind, material: value['material'] as string, rough: value['rough'], metal: value['metal'], height,
    ...(mix === undefined ? {} : { mix }),
  };
}

/**
 * Masks R41: the stored record as the panel uses it, or null when nothing usable is stored (then the material has no masks); `limit` is the most rows (10; a projection masks record passes 32). A record with a
 * bad row, a repeated label or a label the palette lacks is not partly used.
 */
export function parseMasksRecord(raw: unknown, limit: number = MAX_COMPONENTS): MasksRecord | null {
  if (!isObject(raw) || raw['source'] !== 'model') return null;
  const palette = readPalette(raw['palette'], limit);
  if (palette === null || !Array.isArray(raw['rows']) || raw['rows'].length === 0) return null;
  const labels = new Set(palette.map((entry) => entry.label));
  const rows: MaskRow[] = [];
  for (const value of raw['rows']) {
    const row = readRow(value, labels, limit);
    if (row === null || rows.some((other) => other.label === row.label)) return null;
    rows.push(row);
  }
  const feather = typeof raw['feather'] === 'number' && !Number.isNaN(raw['feather']) ? Math.min(Math.max(Math.round(raw['feather']), 0), MAX_FEATHER) : DEFAULT_FEATHER;
  return { source: 'model', palette, feather, rows }; // a stored coverage figure from before R21 was removed is ignored
}

/** Masks R41: the record in the form the material record stores. */
export function serializeMasksRecord(record: MasksRecord): Raw {
  return { ...record, palette: record.palette.map((entry) => ({ ...entry })), rows: record.rows.map((row) => ({ ...row, top3: [...row.top3] })) };
}
