// What the entries and the other apps may use of the desktop storage backend (storage-backends architecture).
export { createDesktopRecordEngine, DEFAULT_MAX_BATCH_BYTES, type DesktopRecordEngine, type EngineTransaction } from './DesktopRecordEngine';
export { createDesktopBlobStore } from './desktopBlobStore';
export { createDesktopVaultStorage } from './desktopVaultStorage';
export { createDesktopStorageHealth } from './desktopStorageHealth';
export { bytesToThumbnail, decodeJsonOr, decodeTile, encodeJsonRecord, encodeTile, parseTileKey, thumbnailToBytes, tileKey, TILE_BYTES, TILE_HALF_FLOATS } from './recordCodecs';
export { BridgeError, type BridgeErrorKind } from './bridgeError';
export type { RecordBridge, RecordEntry, RecordOp, RecordQuery } from './RecordBridge';
export type { FileBridge, FileWriter } from './FileBridge';
export { MAX_CHUNK_BYTES } from './FileBridge';
export { storeFailureFromBridge, storeFailureFromLibraryOpen } from './bridgeFailure';
export { openDesktopParts, type DesktopOptions, type DesktopParts } from './openDesktopParts';
