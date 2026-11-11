import { storeFailure, type RawRecord, type StoreResult } from '@shared/projects';
import { referencedMapKeys } from './mapOperations';
import type { MapsState } from './mapRecord';

/** What the commit needs from the app: the project's files, the record commit and the browser's storage estimate. */
export interface MapCommitPorts {
  writeBlob(key: string, blob: Blob): Promise<StoreResult<void>>;
  deleteBlob(key: string): Promise<StoreResult<void>>;
  /** Saves the record carrying the next state at once (not debounced, R65) and reports whether it was stored; `masks` is the masks record that goes with it. */
  commit(next: MapsState, masks?: RawRecord): Promise<StoreResult<void>>;
  /** Quota minus usage in bytes, or null when the browser cannot tell (R67). */
  estimateFreeBytes(): Promise<number | null>;
}

export interface MapCommit {
  before: MapsState;
  next: MapsState;
  /** The files this operation creates, by key. */
  newBlobs: ReadonlyMap<string, Blob>;
  /** Keys that fields outside the maps (reference images, ...) still use: never deleted (R28). */
  otherReferencedKeys: ReadonlySet<string>;
  /** The masks record saved in the same commit as the maps (masks R47); left out when the operation does not touch it. */
  masks?: RawRecord;
  ports: MapCommitPorts;
}

const MEGABYTE = 1024 * 1024;
const QUOTA_MARGIN = 1.05; // the free space must exceed the new files by 5% (R67)
const megabytes = (bytes: number): string => (bytes / MEGABYTE).toFixed(1);

/** R67, R69: room for `neededBytes` of new files, with the 5% margin; an unknown amount of free space never blocks. */
export function hasRoomFor(neededBytes: number, freeBytes: number | null): boolean {
  return neededBytes <= 0 || freeBytes === null || freeBytes >= neededBytes * QUOTA_MARGIN;
}

/** R67: the sentence shown when there is no room; the free amount is left out when the browser could not say. */
export function quotaMessage(neededBytes: number, freeBytes: number | null): string {
  const free = freeBytes === null ? '' : `, ${megabytes(freeBytes)} MB free`;
  return `Not enough storage: about ${megabytes(neededBytes)} MB needed${free}. Free space in Settings > Storage.`;
}

async function attempt(work: () => Promise<StoreResult<void>>): Promise<StoreResult<void>> {
  try {
    return await work();
  } catch {
    return storeFailure('storage-unavailable', 'The picture could not be saved.');
  }
}

/**
 * R29, R67-R69: check the room for all new files, write them, commit the record once, then delete the files nothing references any more.
 * A failure before the commit leaves the record unchanged and removes the files already written; a failed delete is left to the next sweep (R31).
 */
export async function commitMapOperation({ before, next, newBlobs, otherReferencedKeys, masks, ports }: MapCommit): Promise<StoreResult<void>> {
  const needed = [...newBlobs.values()].reduce((sum, blob) => sum + blob.size, 0);
  const free = needed > 0 ? await ports.estimateFreeBytes().catch(() => null) : null;
  if (!hasRoomFor(needed, free)) return storeFailure('quota-exceeded', quotaMessage(needed, free));

  const written: string[] = [];
  const undoWrites = async (): Promise<void> => {
    for (const key of written) await attempt(() => ports.deleteBlob(key));
  };
  for (const [key, blob] of newBlobs) {
    const result = await attempt(() => ports.writeBlob(key, blob));
    if (!result.ok) {
      await undoWrites();
      return result.error.code === 'quota-exceeded' ? storeFailure('quota-exceeded', quotaMessage(needed, null)) : result;
    }
    written.push(key);
  }
  const committed = await attempt(() => masks === undefined ? ports.commit(next) : ports.commit(next, masks));
  if (!committed.ok) {
    await undoWrites();
    return committed;
  }
  const kept = referencedMapKeys(next);
  for (const key of referencedMapKeys(before)) {
    if (!kept.has(key) && !otherReferencedKeys.has(key)) await attempt(() => ports.deleteBlob(key));
  }
  return committed;
}
