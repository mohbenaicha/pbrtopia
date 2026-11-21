import { clampControlValue, type EditValues } from '../filters/editControls';
import { createDefaultNormalValues, normalControls } from './normalParams';

// Normal-from-height R6: the normal parameters last used, kept in the material record as plain JSON (app R26) and read back with every value checked.

type RawObject = Record<string, unknown>;
const isObject = (value: unknown): value is RawObject => typeof value === 'object' && value !== null && !Array.isArray(value);

/** The remembered values that are usable: numbers, clamped to their range. Anything else is left out. */
export function readNormalSettings(raw: RawObject | undefined): EditValues {
  const values: EditValues = {};
  if (!isObject(raw)) return values;
  for (const control of normalControls) {
    const stored = raw[control.id];
    if (typeof stored === 'number' && Number.isFinite(stored)) values[control.id] = clampControlValue(control, stored);
  }
  return values;
}

/** The parameters to start from: what was remembered, the rest at the defaults. */
export const normalValuesFor = (remembered: EditValues): EditValues => ({ ...createDefaultNormalValues(), ...remembered });

/** The record's `normalParams` after a use of the tool: just the two parameters used. */
export const writeNormalSettings = (values: EditValues): RawObject => ({ ...normalValuesFor(values) });
