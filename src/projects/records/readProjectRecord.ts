import type { MeshRecord, UnwrapReport } from '../../projection/engine';
import { FieldProblem, readBlobKey, readChoice, readCount, readDuration, readList, readNonEmptyText, readObject, readOptional, readText, readTimestamp, type RawRecord } from './fieldReaders';
import { CURRENT_SCHEMA_VERSION, normalizeProjectName, type GenerateSettingsRecord, type ProjectRecord, type ReferenceImageRecord, type TextureRecord } from './projectRecords';

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

function readTexture(value: unknown, path: string): TextureRecord {
  const raw = readObject(value, path);
  const texture: TextureRecord = {
    materialName: readText(raw['materialName'], `${path}.materialName`),
    channel: readChoice(raw['channel'], `${path}.channel`, ['albedo', 'normal', 'rough', 'metal'] as const),
    blobKey: readBlobKey(raw['blobKey'], `${path}.blobKey`),
    width: readCount(raw['width'], `${path}.width`, 1),
    height: readCount(raw['height'], `${path}.height`, 1),
    colorSpace: readChoice(raw['colorSpace'], `${path}.colorSpace`, ['srgb', 'linear'] as const),
    source: readChoice(raw['source'], `${path}.source`, ['file', 'baked'] as const),
  };
  const setId = readOptional(raw['setId'], (present) => readNonEmptyText(present, `${path}.setId`));
  if (setId !== undefined) texture.setId = setId;
  return texture;
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
    quality: readChoice(raw['quality'], `${path}.quality`, ['low', 'medium', 'high'] as const),
  };
}

// The stored name follows the same rule as a new one: trimmed, 1 to 120 characters.
function readProjectName(value: unknown): string {
  const name = normalizeProjectName(readText(value, 'name'));
  if (name === null) throw new FieldProblem('name');
  return name;
}

// Reads a version-1 project from stored JSON. Unknown fields are dropped; a wrong or missing value throws a FieldProblem naming it.
export function readProjectRecord(raw: RawRecord): ProjectRecord {
  const record: ProjectRecord = {
    schemaVersion: CURRENT_SCHEMA_VERSION,
    id: readNonEmptyText(raw['id'], 'id'),
    name: readProjectName(raw['name']),
    createdAt: readTimestamp(raw['createdAt'], 'createdAt'),
    updatedAt: readTimestamp(raw['updatedAt'], 'updatedAt'),
    mesh: readMesh(raw['mesh'], 'mesh'),
    modelBlobKey: readBlobKey(raw['modelBlobKey'], 'modelBlobKey'),
    textures: readList(raw['textures'], 'textures', readTexture),
    generate: readGenerateSettings(raw['generate'], 'generate'),
    setIds: readList(raw['setIds'], 'setIds', readNonEmptyText),
  };
  const activeSetId = readOptional(raw['activeSetId'], (present) => readNonEmptyText(present, 'activeSetId'));
  if (activeSetId !== undefined) record.activeSetId = activeSetId;
  const thumbnailKey = readOptional(raw['thumbnailKey'], (present) => readBlobKey(present, 'thumbnailKey'));
  if (thumbnailKey !== undefined) record.thumbnailKey = thumbnailKey;
  return record;
}
