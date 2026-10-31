import type { MeshRecord } from '../../projection/engine';
import type { PictureRecord, SlotRecord } from './pictureRecords';

// The version of the set and settings records. The project record has its own, below: it moved to 2 with pictures and slots (specs/app/textures).
export const CURRENT_SCHEMA_VERSION = 1;
export const PROJECT_SCHEMA_VERSION = 2;
export const MAX_PROJECT_NAME_LENGTH = 120;

export interface ReferenceImageRecord {
  id: string;
  blobKey: string;
  name: string;
  width: number;
  height: number;
}

// The generate panel's saved choices for one project; `generation/` owns what the values mean.
export interface GenerateSettingsRecord {
  prompt: string;
  referenceImages: ReferenceImageRecord[];
  channel: 'albedo';
  provider: 'gemini' | 'openai';
  modelId: string;
  resolutionKey: '1K' | '2K' | '2.8K' | '4K'; // the output size asked of the image model
  atlasKey: '1K' | '2K' | '4K'; // the size of the atlas sent in (generate R16)
  atlasRender: 'grey' | 'wireframe' | 'viewport'; // how the atlas snapshots are drawn (generate R37)
  tileBorder: boolean; // a white border around every atlas tile (generate R40)
  quality: string; // a level name from the chosen model's list (minimal, low, medium, high, xhigh, ...); never empty
}

export interface ProjectRecord {
  schemaVersion: number;
  id: string; // uuid
  name: string;
  createdAt: string; // ISO time
  updatedAt: string;
  mesh: MeshRecord;
  modelBlobKey: string;
  pictures: PictureRecord[]; // generated pictures, oldest first
  slots: SlotRecord[]; // overrides only
  generate: GenerateSettingsRecord;
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
  triangleCount: number;
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
