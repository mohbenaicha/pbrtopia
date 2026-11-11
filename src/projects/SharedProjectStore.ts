import type { AppSettingsRecord } from './records/appSettingsRecord';
import type { ProjectSummary } from './records/projectRecords';
import type { StorageEstimate } from './storage/storageHealth';
import type { StoreResult } from './storeError';

// What the shared shell, the settings sections and the project list need from any app's store, whatever its project record holds.
// Methods are declared in method style on purpose: an app's settings record may add fields of its own (the material app's `previewPrefs`).
export interface SharedProjectStore {
  listProjects(): Promise<StoreResult<ProjectSummary[]>>; // newest change first
  /** Only whether the project exists and can be opened matters to the shell; the record's shape is the app's. */
  loadProject(id: string): Promise<StoreResult<unknown>>;
  renameProject(id: string, name: string): Promise<StoreResult<void>>;
  /** Irreversible. Unknown ids are skipped; stops at the first failure. */
  deleteProjects(ids: string[], onProgress?: (done: number, total: number) => void): Promise<StoreResult<void>>;
  loadThumbnail(projectId: string): Promise<Blob | null>;
  /** Always a record: defaults when none is stored or it cannot be read. */
  loadAppSettings(): Promise<AppSettingsRecord>;
  /** Merges the named top-level fields onto the stored settings. */
  saveAppSettings(patch: Partial<AppSettingsRecord>): Promise<StoreResult<void>>;
  /** True when the browser keeps (or has just agreed to keep) this origin's storage. */
  requestPersistence(): Promise<boolean>;
  /** Bytes used and the quota, or null when the browser cannot say. */
  estimateStorage(): Promise<StorageEstimate | null>;
}
