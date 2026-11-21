import {
  FieldProblem, MAX_PROJECT_NAME_LENGTH, applyMigrationSteps, readBlobKey, readChoice, readCount, readList, readNonEmptyText, readObject, readOptional, readText, readTimestamp, storeFailure,
  type MigrationSteps, type RawRecord, type StoreResult,
} from '@shared/projects';
import { MAP_KINDS, type MapKind, type MapSource } from '@mat/maps';
import {
  COLOR_MODES, MATERIAL_SCHEMA_VERSION, MATERIAL_SIZES, type DerivedFromRecord, type MapRecord, type MapUndoEntry, type MaterialRecord,
} from './materialRecord';
import { readPreviewValues } from './previewValues';

const MAX_TEXT_LENGTH = 100_000; // no field holds image data (app R29): a longer text, or a data URI, is refused
export const INVALID_PROJECT = 'Invalid project.';
export const NEWER_VERSION = 'This project was saved by a newer version.';

// One entry per schema change from version 2 on, keyed by the version it upgrades from.
const MATERIAL_MIGRATION_STEPS: MigrationSteps = {};

const MAX_NESTING = 64; // a free-form object deeper than this is not a plan or a masks record
const DATA_URI = /^\s*data:[^,;\s]*[;,]/i; // "data:image/png;base64,..." in any case; prose that starts with the word "data" is not one

/** App R29: image data is a data URI or a text too long to be anything else. */
const isImageData = (text: string): boolean => text.length > MAX_TEXT_LENGTH || DATA_URI.test(text);

function readPlainText(value: unknown, path: string): string {
  const text = readText(value, path);
  if (isImageData(text)) throw new FieldProblem(path);
  return text;
}

function readDerivedFrom(value: unknown, path: string): DerivedFromRecord {
  const raw = readObject(value, path);
  return { kind: readChoice(raw['kind'], `${path}.kind`, MAP_KINDS), key: readBlobKey(raw['key'], `${path}.key`) };
}

function readUndoEntry(value: unknown, path: string): MapUndoEntry {
  const raw = readObject(value, path);
  const entry: MapUndoEntry = { label: readPlainText(raw['label'], `${path}.label`) };
  const derivedFrom = readOptional(raw['derivedFrom'], (present) => readDerivedFrom(present, `${path}.derivedFrom`));
  const groupId = readOptional(raw['groupId'], (present) => readNonEmptyText(present, `${path}.groupId`));
  const size = readOptional(raw['size'], (present) => readChoice(present, `${path}.size`, MATERIAL_SIZES));
  const offsetBase = readOptional(raw['offsetBase'], (present) => readNonEmptyText(present, `${path}.offsetBase`));
  if (derivedFrom) entry.derivedFrom = derivedFrom;
  if (offsetBase !== undefined) entry.offsetBase = offsetBase;
  if (groupId !== undefined) entry.groupId = groupId;
  if (size !== undefined) entry.size = size;
  return entry;
}

function readMapSource(value: unknown, path: string): MapSource {
  const raw = readObject(value, path);
  const kind = readChoice(raw['kind'], `${path}.kind`, ['generated', 'computed', 'dropped'] as const);
  return kind === 'dropped' ? { kind, name: readPlainText(raw['name'], `${path}.name`) } : { kind };
}

function readMap(kind: MapKind, value: unknown, path: string): MapRecord {
  const raw = readObject(value, path);
  const undoKey = raw['undoKey'] === null ? null : readBlobKey(raw['undoKey'], `${path}.undoKey`);
  const map: MapRecord = {
    originalKey: readBlobKey(raw['originalKey'], `${path}.originalKey`),
    workingKey: readBlobKey(raw['workingKey'], `${path}.workingKey`),
    undoKey,
    width: readCount(raw['width'], `${path}.width`, 1),
    height: readCount(raw['height'], `${path}.height`, 1),
  };
  if (undoKey !== null) {
    if (kind === 'labels') throw new FieldProblem(`${path}.undoKey`); // the decomposition never has an undo entry (maps R6)
    map.undo = readUndoEntry(raw['undo'], `${path}.undo`);
  }
  const derivedFrom = readOptional(raw['derivedFrom'], (present) => readDerivedFrom(present, `${path}.derivedFrom`));
  if (derivedFrom) map.derivedFrom = derivedFrom;
  const offsetBase = readOptional(raw['offsetBase'], (present) => readNonEmptyText(present, `${path}.offsetBase`));
  if (offsetBase !== undefined) map.offsetBase = offsetBase;
  const source = readOptional(raw['source'], (present) => readMapSource(present, `${path}.source`));
  if (source) map.source = source;
  return map;
}

function readMaps(value: unknown, path: string): MaterialRecord['maps'] {
  const raw = readObject(value, path);
  const maps: MaterialRecord['maps'] = {};
  for (const [name, entry] of Object.entries(raw)) {
    const kind = readChoice(name, `${path}.${name}`, MAP_KINDS);
    maps[kind] = readMap(kind, entry, `${path}.${name}`);
  }
  return maps;
}

/** App R29: no string anywhere inside a free-form object is image data (a data URI or an over-long text). */
function refuseNestedImageData(value: unknown, path: string, depth = 0): void {
  if (depth > MAX_NESTING) throw new FieldProblem(path);
  if (typeof value === 'string') {
    if (isImageData(value)) throw new FieldProblem(path);
  } else if (Array.isArray(value)) value.forEach((entry, index) => refuseNestedImageData(entry, `${path}[${index}]`, depth + 1));
  else if (value !== null && typeof value === 'object') {
    for (const [key, entry] of Object.entries(value)) {
      if (isImageData(key)) throw new FieldProblem(path);
      refuseNestedImageData(entry, `${path}.${key}`, depth + 1);
    }
  }
}

const readJsonObject = (value: unknown, path: string): RawRecord => {
  const object = readObject(value, path);
  refuseNestedImageData(object, path); // before the copy, so a refused object is never cloned
  try {
    return structuredClone(object);
  } catch {
    throw new FieldProblem(path); // a function or other value that is not plain data
  }
};

/** Checks every field of an upgraded record, dropping fields this version does not know. */
export function readMaterialRecord(raw: RawRecord): MaterialRecord {
  const name = readPlainText(raw['name'], 'name');
  if (name.length === 0 || name.length > MAX_PROJECT_NAME_LENGTH) throw new FieldProblem('name');
  const record: MaterialRecord = {
    schemaVersion: MATERIAL_SCHEMA_VERSION,
    id: readNonEmptyText(raw['id'], 'id'),
    name,
    createdAt: readTimestamp(raw['createdAt'], 'createdAt'),
    updatedAt: readTimestamp(raw['updatedAt'], 'updatedAt'),
    kind: readChoice(raw['kind'], 'kind', ['texture'] as const),
    size: raw['size'] === null ? null : readChoice(raw['size'], 'size', MATERIAL_SIZES),
    colorMode: readChoice(raw['colorMode'], 'colorMode', COLOR_MODES),
    prompt: readPlainText(raw['prompt'], 'prompt'),
    referenceImages: readList(raw['referenceImages'], 'referenceImages', readBlobKey),
    presetId: readNonEmptyText(raw['presetId'], 'presetId'),
    maps: readMaps(raw['maps'], 'maps'),
    preview: readPreviewValues(raw['preview']),
  };
  const thumbnailKey = readOptional(raw['thumbnailKey'], (present) => readBlobKey(present, 'thumbnailKey'));
  const customPlan = readOptional(raw['customPlan'], (present) => readJsonObject(present, 'customPlan'));
  const masks = readOptional(raw['masks'], (present) => readJsonObject(present, 'masks'));
  const aoParams = readOptional(raw['aoParams'], (present) => readJsonObject(present, 'aoParams'));
  const normalParams = readOptional(raw['normalParams'], (present) => readJsonObject(present, 'normalParams'));
  if (thumbnailKey !== undefined) record.thumbnailKey = thumbnailKey;
  if (raw['partlyDeleted'] === true) record.partlyDeleted = true;
  if (customPlan) record.customPlan = customPlan;
  if (masks) record.masks = masks;
  if (aoParams) record.aoParams = aoParams;
  if (normalParams) record.normalParams = normalParams;
  return record;
}

/** Loads a stored record: upgrades an older version, refuses a newer one (left untouched in storage) and checks every field (app R28, R29). */
export function migrateMaterialRecord(raw: unknown): StoreResult<MaterialRecord> {
  let upgraded: ReturnType<typeof applyMigrationSteps>;
  try {
    upgraded = applyMigrationSteps(raw, MATERIAL_SCHEMA_VERSION, MATERIAL_MIGRATION_STEPS);
  } catch {
    return storeFailure('corrupt', `${INVALID_PROJECT} (nesting)`); // the copy of a record nested beyond what the engine can clone
  }
  if (!upgraded.ok) return upgraded.error.code === 'schema-too-new' ? storeFailure('schema-too-new', NEWER_VERSION) : upgraded;
  try {
    return { ok: true, value: readMaterialRecord(upgraded.value) };
  } catch (problem) {
    if (problem instanceof FieldProblem) return storeFailure('corrupt', `${INVALID_PROJECT} (${problem.fieldPath})`);
    throw problem;
  }
}
