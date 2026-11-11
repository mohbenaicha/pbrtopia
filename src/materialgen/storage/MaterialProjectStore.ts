import type { SharedProjectStore, StoreResult } from '@shared/projects';
import type { MaterialRecord, MaterialSize } from './materialRecord';
import type { MaterialSettingsRecord } from './materialSettings';

export interface NewMaterialProjectInput {
  name: string;
  size: MaterialSize | null;
}

/** What opening a project found on disk against its record (app R34). */
export interface SweepOutcome {
  deleted: number; // files no field referenced, now gone
  missing: string[]; // keys the record references that cannot be read
}

// What the material app stores (app R30). Methods are in method style so the shared shell accepts the wider settings record.
export interface MaterialProjectStore extends SharedProjectStore {
  createProject(input: NewMaterialProjectInput): Promise<StoreResult<MaterialRecord>>;
  loadProject(id: string): Promise<StoreResult<MaterialRecord>>;
  /** Replaces the record (checked, app R29); the thumbnail marker stays as stored and `updatedAt` is set. */
  saveProject(record: MaterialRecord): Promise<StoreResult<void>>;
  /** Puts back a whole project under its own id (a zip import); refuses an id already in use. Its files must already be stored. */
  restoreProject(record: MaterialRecord): Promise<StoreResult<MaterialRecord>>;
  readBlob(projectId: string, key: string): Promise<Blob | null>;
  writeBlob(projectId: string, key: string, blob: Blob): Promise<StoreResult<void>>;
  /** A file that is not there counts as removed. */
  deleteBlob(projectId: string, key: string): Promise<StoreResult<void>>;
  /** Deletes the files no field of the record references and reports referenced files that cannot be read. Call it when a project opens writable. */
  sweepOrphanBlobs(projectId: string): Promise<StoreResult<SweepOutcome>>;
  saveThumbnail(projectId: string, jpeg: Blob): Promise<StoreResult<void>>;
  loadAppSettings(): Promise<MaterialSettingsRecord>;
  saveAppSettings(patch: Partial<MaterialSettingsRecord>): Promise<StoreResult<void>>;
}
