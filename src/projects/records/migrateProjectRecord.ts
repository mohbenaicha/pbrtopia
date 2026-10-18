import { storeFailure, type StoreResult } from '../storeError';
import { FieldProblem, isRawRecord, type RawRecord } from './fieldReaders';
import { CURRENT_SCHEMA_VERSION, type ProjectRecord } from './projectRecords';
import { readProjectRecord } from './readProjectRecord';

// Turns a record of version N into one of version N + 1.
export type MigrationStep = (record: RawRecord) => RawRecord;
export type MigrationSteps = Readonly<Record<number, MigrationStep>>; // keyed by the version a step upgrades from

// One entry per schema change: version 1 is the first, so there is nothing to upgrade from yet.
const PROJECT_MIGRATION_STEPS: MigrationSteps = {};

// Brings a stored record to `currentVersion`, one step at a time, on a copy. A newer version is refused before anything runs.
export function applyMigrationSteps(raw: unknown, currentVersion: number, steps: MigrationSteps): StoreResult<RawRecord> {
  if (!isRawRecord(raw)) return storeFailure('corrupt', 'The saved project is not a valid record.');
  const found = raw['schemaVersion'];
  if (typeof found !== 'number' || !Number.isInteger(found) || found < 1) return storeFailure('corrupt', 'The saved project has no valid version number (schemaVersion).');
  if (found > currentVersion) {
    return storeFailure('schema-too-new', `This project was saved by a newer version of the app (data version ${found}; this app reads up to ${currentVersion}). Update the app to open it.`);
  }
  let record: RawRecord = { ...raw };
  for (let version = found; version < currentVersion; version += 1) {
    const step = steps[version];
    if (!step) return storeFailure('corrupt', `The saved project is at data version ${found} and cannot be upgraded (no step from ${version}).`);
    try {
      record = { ...step({ ...record }), schemaVersion: version + 1 };
    } catch {
      return storeFailure('corrupt', `The saved project could not be upgraded from data version ${version}.`);
    }
  }
  return { ok: true, value: record };
}

// Loads a stored project: upgrades older versions, refuses newer ones and checks every field, dropping fields it does not know.
export function migrateProjectRecord(raw: unknown): StoreResult<ProjectRecord> {
  const upgraded = applyMigrationSteps(raw, CURRENT_SCHEMA_VERSION, PROJECT_MIGRATION_STEPS);
  if (!upgraded.ok) return upgraded;
  try {
    return { ok: true, value: readProjectRecord(upgraded.value) };
  } catch (problem) {
    if (problem instanceof FieldProblem) return storeFailure('corrupt', problem.message);
    throw problem;
  }
}
