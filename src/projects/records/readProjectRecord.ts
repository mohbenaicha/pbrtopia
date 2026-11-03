import type { MeshRecord, UnwrapReport } from '../../projection/engine';
import { FieldProblem, readBlobKey, readChoice, readCount, readDuration, readFlag, readList, readNonEmptyText, readObject, readOptional, readText, readTimestamp, type RawRecord } from './fieldReaders';
import { readCustomPlan, readCustomSetups } from './customPlanRecords';
import { readPictures, readSlots } from './pictureRecords';
import { PROJECT_SCHEMA_VERSION, normalizeProjectName, type GenerateSettingsRecord, type ProjectRecord, type ReferenceImageRecord } from './projectRecords';

function readUnwrap(value: unknown, path: string): UnwrapReport {
  const raw = readObject(value, path);
  const options = readObject(raw['options'], `${path}.options`);
  return {
    options: { resolution: readChoice(options['resolution'], `${path}.options.resolution`, [1024, 2048, 4096] as const), paddingTexels: readCount(options['paddingTexels'], `${path}.options.paddingTexels`) },
    vertsBefore: readCount(raw['vertsBefore'], `${path}.vertsBefore`),
    vertsAfter: readCount(raw['vertsAfter'], `${path}.vertsAfter`),
    ms: readDuration(raw['ms'], `${path}.ms`),
    library: readText(raw['library'], `${path}.library`),
    libraryVersion: readText(raw['libraryVersion'], `${path}.libraryVersion`),
  };
}

function readMesh(value: unknown, path: string): MeshRecord {
  const raw = readObject(value, path);
  const mesh: MeshRecord = {
    id: readNonEmptyText(raw['id'], `${path}.id`),
    name: readText(raw['name'], `${path}.name`),
    vertexCount: readCount(raw['vertexCount'], `${path}.vertexCount`),
    triangleCount: readCount(raw['triangleCount'], `${path}.triangleCount`),
    uvSource: readChoice(raw['uvSource'], `${path}.uvSource`, ['file', 'generated', 'none'] as const),
  };
  const unwrap = readOptional(raw['unwrap'], (present) => readUnwrap(present, `${path}.unwrap`));
  if (unwrap) mesh.unwrap = unwrap;
  return mesh;
}

function readReferenceImage(value: unknown, path: string): ReferenceImageRecord {
  const raw = readObject(value, path);
  return {
    id: readNonEmptyText(raw['id'], `${path}.id`),
    blobKey: readBlobKey(raw['blobKey'], `${path}.blobKey`),
    name: readText(raw['name'], `${path}.name`),
    width: readCount(raw['width'], `${path}.width`, 1),
    height: readCount(raw['height'], `${path}.height`, 1),
  };
}

function readGenerateSettings(value: unknown, path: string): GenerateSettingsRecord {
  const raw = readObject(value, path);
  return {
    prompt: readText(raw['prompt'], `${path}.prompt`),
    referenceImages: readList(raw['referenceImages'], `${path}.referenceImages`, readReferenceImage),
    channel: readChoice(raw['channel'], `${path}.channel`, ['albedo'] as const),
    provider: readChoice(raw['provider'], `${path}.provider`, ['gemini', 'openai'] as const),
    modelId: readText(raw['modelId'], `${path}.modelId`),
    resolutionKey: readChoice(raw['resolutionKey'], `${path}.resolutionKey`, ['1K', '2K', '2.8K', '4K'] as const),
    atlasKey: raw['atlasKey'] === undefined ? '2K' : readChoice(raw['atlasKey'], `${path}.atlasKey`, ['1K', '2K', '4K'] as const), // absent in projects saved before generate R16
    atlasRender: raw['atlasRender'] === undefined ? 'grey' : readChoice(raw['atlasRender'], `${path}.atlasRender`, ['grey', 'wireframe', 'depth', 'depth-wireframe', 'viewport'] as const), // absent in projects saved before generate R37
    tileBorder: raw['tileBorder'] === undefined ? true : readFlag(raw['tileBorder'], `${path}.tileBorder`), // absent in projects saved before generate R40
    quality: readNonEmptyText(raw['quality'], `${path}.quality`), // any level a model offers (generate spec R5); an unknown one is kept and the panel falls back
    mode: raw['mode'] === undefined ? 'standard' : readChoice(raw['mode'], `${path}.mode`, ['standard', 'custom'] as const), // absent in projects saved before custom generation (custom R28)
    customPlan: raw['customPlan'] === undefined || raw['customPlan'] === null ? null : readCustomPlan(raw['customPlan'], `${path}.customPlan`),
    customSetups: raw['customSetups'] === undefined ? [] : readCustomSetups(raw['customSetups'], `${path}.customSetups`),
  };
}

// The stored name follows the same rule as a new one: trimmed, 1 to 120 characters.
function readProjectName(value: unknown): string {
  const name = normalizeProjectName(readText(value, 'name'));
  if (name === null) throw new FieldProblem('name');
  return name;
}

// Reads a current-version project from stored JSON. Unknown fields are dropped; a wrong or missing value throws a FieldProblem naming it (slots are the exception: bad ones are ignored).
export function readProjectRecord(raw: RawRecord): ProjectRecord {
  const pictures = readPictures(raw['pictures'], 'pictures');
  const record: ProjectRecord = {
    schemaVersion: PROJECT_SCHEMA_VERSION,
    id: readNonEmptyText(raw['id'], 'id'),
    name: readProjectName(raw['name']),
    createdAt: readTimestamp(raw['createdAt'], 'createdAt'),
    updatedAt: readTimestamp(raw['updatedAt'], 'updatedAt'),
    mesh: readMesh(raw['mesh'], 'mesh'),
    modelBlobKey: readBlobKey(raw['modelBlobKey'], 'modelBlobKey'),
    pictures,
    slots: readSlots(raw['slots'], pictures),
    generate: readGenerateSettings(raw['generate'], 'generate'),
    setIds: readList(raw['setIds'], 'setIds', readNonEmptyText),
  };
  const activeSetId = readOptional(raw['activeSetId'], (present) => readNonEmptyText(present, 'activeSetId'));
  if (activeSetId !== undefined) record.activeSetId = activeSetId;
  const originalModelBlobKey = readOptional(raw['originalModelBlobKey'], (present) => readBlobKey(present, 'originalModelBlobKey'));
  if (originalModelBlobKey !== undefined) record.originalModelBlobKey = originalModelBlobKey;
  const thumbnailKey = readOptional(raw['thumbnailKey'], (present) => readBlobKey(present, 'thumbnailKey'));
  if (thumbnailKey !== undefined) record.thumbnailKey = thumbnailKey;
  return record;
}
