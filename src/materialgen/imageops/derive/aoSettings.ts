import { clampControlValue, type EditValues } from '../filters/editControls';
import { aoControlsFor, createDefaultAoValues, type AoSource } from './aoParams';

// Imageops R43, R44: the AO parameters last used, kept in the material record as plain JSON (app R26) and read back with every value checked.

export interface AoSettings {
  source?: AoSource;
  values: Partial<Record<AoSource, EditValues>>;
}

const SOURCES: readonly AoSource[] = ['height', 'normal'];
type RawObject = Record<string, unknown>;
const isObject = (value: unknown): value is RawObject => typeof value === 'object' && value !== null && !Array.isArray(value);

function readValues(source: AoSource, raw: unknown): EditValues | undefined {
  if (!isObject(raw)) return undefined;
  const values: EditValues = {};
  for (const control of aoControlsFor(source)) {
    const stored = raw[control.id];
    if (typeof stored === 'number' && Number.isFinite(stored)) values[control.id] = clampControlValue(control, stored);
  }
  return values;
}

export function readAoSettings(raw: RawObject | undefined): AoSettings {
  const settings: AoSettings = { values: {} };
  if (!isObject(raw)) return settings;
  if (typeof raw['source'] === 'string' && (SOURCES as readonly string[]).includes(raw['source'])) settings.source = raw['source'] as AoSource;
  for (const source of SOURCES) {
    const values = readValues(source, raw[source]);
    if (values !== undefined) settings.values[source] = values;
  }
  return settings;
}

/** The parameters to start from for a source: what was remembered, the rest at the defaults (R43). */
export const aoValuesFor = (settings: AoSettings, source: AoSource): EditValues => ({ ...createDefaultAoValues(source), ...settings.values[source] });

/** The record's `aoParams` after a use of the tool: the other source's values stay, and `source` says which one was used. */
export function writeAoSettings(raw: RawObject | undefined, source: AoSource, values: EditValues): RawObject {
  const kept = isObject(raw) ? raw : {};
  return { ...kept, source, [source]: { ...values } };
}
