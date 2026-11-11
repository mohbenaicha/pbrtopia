// What apps other than the projection app may use of project storage: the app-agnostic parts only (materialgen-prep R7, R59, R60).
// The projection app's own store, records and zip handling are not exported.

export type { SharedProjectStore } from './SharedProjectStore';
export { StoreAbort, storeFailure, type StoreError, type StoreErrorCode, type StoreResult } from './storeError';

export { THUMBNAIL_MARKER } from './records/blobKeys';
export { readAppSettings, DEFAULT_APP_SETTINGS, type AppSettingsRecord } from './records/appSettingsRecord';
export {
  FieldProblem, isRawRecord, readBlobKey, readChoice, readCount, readFlag, readList, readNonEmptyText, readNumber, readObject, readOptional, readText, readTimestamp, type RawRecord,
} from './records/fieldReaders';
export { applyMigrationSteps, type MigrationSteps } from './records/migrateProjectRecord';
export { MAX_PROJECT_NAME_LENGTH, isSafeBlobKey, normalizeProjectName, type ProjectSummary } from './records/projectRecords';

export { isSafeProjectId, type BlobStore } from './storage/BlobStore';
export { createOpfsBlobStore, openOpfsRoot } from './storage/opfsBlobStore';
export { openRecordDatabase, runRecordTransaction, settle } from './storage/recordTransactions';
export { createStorageOperations, isStorageLow, type StorageEstimate, type StorageManagerLike } from './storage/storageHealth';

export { streamZipEntries, encodeJsonBytes, isDeflatable, type ZipFileEntry } from './zip/streamZipEntries';
export { describeFailure, readZipEntries, type ZipEntry } from './zip/readZipEntries';
export { findChecksumProblem, hasEndRecord } from './zip/verifyZipChecksums';
export { concatEntryBytes, parseJsonEntry } from './zip/zipEntryContent';
export { reject, shorten } from './zip/zipRejection';
export { MANIFEST_PATH, PROJECT_PATH, ZIP_LIMITS, blobEntryPath } from './zip/zipFormat';

export { acquireProjectLock, type ProjectLock, type ProjectLockRequester } from './lock/acquireProjectLock';
export { createDebouncedSaver, type DebouncedSaver, type SaveEntry } from './autosave/debouncedSaver';
export { flushOnTabHide } from './autosave/flushOnTabHide';

export { ImportProjectButton, ImportProjectStatus, type ProjectImportState } from './ui/ImportProjectButton';
export { ProjectListView, type ListViewStore } from './ui/ProjectListView';
export { QuotaWarning, type QuotaWarningProps } from './ui/QuotaWarning';
