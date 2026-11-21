import { storeFailure, type StoreResult } from '../storeError';
import { FieldProblem, isRawRecord, type RawRecord } from './fieldReaders';
import { PROJECT_SCHEMA_VERSION, type ProjectRecord } from './projectRecords';
import { readProjectRecord } from './readProjectRecord';

// Turns a record of version N into one of version N + 1.
type MigrationStep =(record: RawRecord) => RawRecord;
export type MigrationSteps = Readonly<Record<number, MigrationStep>>; // keyed by the version a step upgrades from

// One entry per schema change from version 2 on. Version 1 has no step: it is refused (below), so its projects are deleted by the user.
// 2 -> 3 (normal-map R14): the new generate fields have reader defaults, so the stored record needs no change.
// 3 -> 4 (mask-mode R22): the masks record is optional and absent in an older project, so it needs no change either.
const PROJECT_MIGRATION_STEPS: MigrationSteps = { 2: (record) => record, 3: (record) => record };
export const OLDEST_READABLE_PROJECT_VERSION = 2;
export const SCHEMA_TOO_OLD_MESSAGE = 'This project was made by an older version of the app and cannot be opened. Delete it.';

/** True for a record whose version is a whole number below the oldest one this app reads (textures R22). */
export const isTooOldProjectRecord = (raw: unknown): boolean => isRawRecord(raw) && Number.isInteger(raw['schemaVersion']) && (raw['schemaVersion'] as number) >= 1 && (raw['schemaVersion'] as number) < OLDEST_READABLE_PROJECT_VERSION;

// Brings a stored record to `currentVersion`, one step at a time, on a copy. A newer version is refused before anything runs.
export function applyMigrationSteps(raw: unknown, currentVersion: number, steps: MigrationSteps): StoreResult<RawRecord> {
  if (!isRawRecord(raw)) return storeFailure('corrupt', 'The saved project is not a valid record.');
  const found = raw['schemaVersion'];
  if (typeof found !== 'number' || !Number.isInteger(found) || found < 1) return storeFailure('corrupt', 'The saved project has no valid version number (schemaVersion).');
  if (found > currentVersion) {
    return storeFailure('schema-too-new', `This project was saved by a newer version of the app (data version ${found}; this app reads up to ${currentVersion}). Update the app to open it.`);
  }
  let record: RawRecord = structuredClone(raw); // deep, so a step that changes a nested value never changes the caller's record
  for (let version = found; version < currentVersion; version += 1) {
    const step = steps[version];
    if (!step) return storeFailure('corrupt', `The saved project is at data version ${found} and cannot be upgraded (no step from ${version}).`);
    try {
      record = { ...step(structuredClone(record)), schemaVersion: version + 1 };
    } catch {
      return storeFailure('corrupt', `The saved project could not be upgraded from data version ${version}.`);
    }
  }
  return { ok: true, value: record };
}

// Loads a stored project: upgrades older versions, refuses newer ones and checks every field, dropping fields it does not know.
export function migrateProjectRecord(raw: unknown): StoreResult<ProjectRecord> {
  if (isTooOldProjectRecord(raw)) return storeFailure('schema-too-old', SCHEMA_TOO_OLD_MESSAGE);
  const upgraded = applyMigrationSteps(raw, PROJECT_SCHEMA_VERSION, PROJECT_MIGRATION_STEPS);
  if (!upgraded.ok) return upgraded;
  try {
    return { ok: true, value: readProjectRecord(upgraded.value) };
  } catch (problem) {
    if (problem instanceof FieldProblem) return storeFailure('corrupt', problem.message);
    throw problem;
  }
}
