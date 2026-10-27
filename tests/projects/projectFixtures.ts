import type { ProjectRecord } from '../../src/projects/records/projectRecords';

// A complete version-2 project: a generated-UV mesh, one baked picture applied to a material, generate settings with a reference, and two sets.
export function sampleProjectRecord(overrides: Partial<ProjectRecord> = {}): ProjectRecord {
  return {
    schemaVersion: 2,
    id: '3f0b2f6e-8c2a-4a57-9a43-0d6f3b1f7a11',
    name: 'Skarrik helmet',
    createdAt: '2026-10-18T09:30:00.000Z',
    updatedAt: '2026-10-18T10:15:00.000Z',
    mesh: {
      id: 'mesh-1',
      name: 'T-skarrik-21k',
      vertexCount: 21034,
      triangleCount: 20812,
      uvSource: 'generated',
      unwrap: { options: { resolution: 2048, paddingTexels: 3 }, vertsBefore: 19000, vertsAfter: 21034, ms: 840, library: 'xatlas-three', libraryVersion: '0.1.0' },
    },
    modelBlobKey: 'model.glb',
    pictures: [{ id: 'pic-1', channel: 'albedo', blobKey: 'pictures/pic-1.png', width: 4096, height: 4096, createdAt: '2026-10-18T10:00:00.000Z', origin: { kind: 'bake', setId: 'set-1' } }],
    slots: [{ materialIndex: 0, materialName: 'Body', channel: 'albedo', pictureId: 'pic-1' }],
    generate: {
      prompt: 'weathered green armour with gold trim',
      referenceImages: [{ id: 'ref-1', blobKey: 'refs/ref-1.png', name: 'armour.png', width: 800, height: 600 }],
      channel: 'albedo',
      provider: 'gemini',
      modelId: 'gemini-3-pro-image',
      resolutionKey: '2K',
      atlasKey: '2K',
      quality: 'medium',
    },
    setIds: ['set-1', 'set-2'],
    activeSetId: 'set-2',
    thumbnailKey: 'thumbnail.jpg',
    ...overrides,
  };
}

export function omit<T extends object, K extends keyof T>(value: T, ...keys: K[]): Omit<T, K> {
  const copy = { ...value };
  keys.forEach((key) => delete copy[key]);
  return copy;
}

// The same record as it comes back from storage: plain JSON.
export const roundTripped = (record: unknown): unknown => JSON.parse(JSON.stringify(record));
