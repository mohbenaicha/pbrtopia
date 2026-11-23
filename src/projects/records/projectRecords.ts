import type { MeshRecord } from './meshRecord';
import type { CustomPlanStoredRecord, NamedPlanStoredRecord } from './customPlanRecords';
import type { PictureRecord, SlotRecord } from './pictureRecords';
import type { ProjectMasksRecord } from './projectMasksRecord';
import type { StoredProvider } from './storedProviders';

// The version of the set and settings records. The project record has its own, below: it moved to 2 with pictures and slots (specs/app/textures).
export const CURRENT_SCHEMA_VERSION = 1;
export const PROJECT_SCHEMA_VERSION = 5; // 3: channel union and normalDetail (generation/normal-map R14); 4: the masks record and the masks picture origin (projection/mask-mode R22); 5: 32 components with ids, a null source albedo (mask-mode R22, no data change)
export const MAX_PROJECT_NAME_LENGTH = 120;

export interface ReferenceImageRecord {
  id: string;
  blobKey: string;
  name: string;
  width: number;
  height: number;
}

export type GenerateChannelValue = 'albedo' | 'normal' | 'metal-rough';

// The generate panel's saved choices for one project; `generation/` owns what the values mean.
export interface GenerateSettingsRecord {
  prompt: string;
  referenceImages: ReferenceImageRecord[];
  channel: GenerateChannelValue;
  normalDetail: 1 | 2 | 3 | 4; // how much fine relief a normal map asks for (normal-map R5)
  provider: StoredProvider;
  modelId: string;
  resolutionKey: '1K' | '2K' | '2.8K' | '4K'; // the output size asked of the image model
  atlasKey: '1K' | '2K' | '4K'; // the size of the atlas sent in (generate R16)
  atlasRender: 'grey' | 'wireframe' | 'depth' | 'depth-wireframe' | 'viewport'; // how the atlas snapshots are drawn (generate R37)
  tileBorder: boolean; // a white border around every atlas tile (generate R40)
  quality: string; // a level name from the chosen model's list (minimal, low, medium, high, xhigh, ...); never empty
  mode: 'standard' | 'custom'; // custom R28: absent in older projects, which read as standard
  customPlan: CustomPlanStoredRecord | null; // the confirmed plan; null until the first Confirm
  customSetups: NamedPlanStoredRecord[]; // saved setups, oldest first
}

export interface ProjectRecord {
  schemaVersion: number;
  id: string; // uuid
  name: string;
  createdAt: string; // ISO time
  updatedAt: string;
  mesh: MeshRecord;
  modelBlobKey: string;
  originalModelBlobKey?: string; // the model as it was before the first mesh edit (mesh edit R26); absent until then. Store-owned like modelBlobKey.
  pictures: PictureRecord[]; // generated pictures, oldest first
  slots: SlotRecord[]; // overrides only
  generate: GenerateSettingsRecord;
  masks?: ProjectMasksRecord; // the project's one set of material masks; absent until a mask set is baked
  setIds: string[]; // newest last
  activeSetId?: string; // the set last open in projection mode
  thumbnailKey?: string;
}

// What the project list needs, so listing never loads a whole record's worth of anything heavy.
export interface ProjectSummary {
  id: string;
  name: string;
  updatedAt: string;
  thumbnailKey?: string;
  triangleCount?: number; // the projection app's size line; the material app sets `detail` instead
  detail?: string; // what the card shows in place of the triangle count (kind and size)
  unreadable?: string; // why the project cannot be opened (a record of an older version); it can still be deleted
}

// Free text, trimmed, 1 to 120 characters; null when it cannot be used as a name.
export function normalizeProjectName(input: string): string | null {
  const name = input.trim();
  return name.length === 0 || name.length > MAX_PROJECT_NAME_LENGTH ? null : name;
}

export function summarizeProject(record: ProjectRecord): ProjectSummary {
  const summary: ProjectSummary = { id: record.id, name: record.name, updatedAt: record.updatedAt, triangleCount: record.mesh.triangleCount };
  if (record.thumbnailKey !== undefined) summary.thumbnailKey = record.thumbnailKey;
  return summary;
}

// A blob key is a plain relative path inside the project folder: no empty parts, no "." or "..", no drive, no backslash.
export function isSafeBlobKey(key: string): boolean {
  if (key === '' || key.includes('\\') || key.includes('\0') || key.startsWith('/') || /^[A-Za-z]:/.test(key)) return false;
  return key.split('/').every((part) => part !== '' && part !== '.' && part !== '..');
}
