import type { StorageManagerLike } from '../projects';
import type { FileBridge } from './FileBridge';

/**
 * Storage-backends R10: the disk's free space as the storage numbers the warning reads. Persistence is always granted; the estimate puts the
 * free space in as the quota with nothing used, so only the "under 200 MiB free" rule can ever trip (a nearly full disk is not by itself a problem).
 * A disk that will not say gives an estimate with no quota, which reads as unknown.
 */
export function createDesktopStorageHealth(files: FileBridge): StorageManagerLike {
  return {
    persist: async () => true,
    persisted: async () => true,
    estimate: async () => {
      const space = await files.freeSpace();
      return space === null ? {} : { usage: 0, quota: space.free };
    },
  };
}
