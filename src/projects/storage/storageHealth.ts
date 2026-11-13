export interface StorageManagerLike {
  persist?: () => Promise<boolean>;
  persisted?: () => Promise<boolean>;
  estimate?: () => Promise<{ usage?: number; quota?: number }>;
}

/** Desktop mode only (storage-backends R10): where the library folder is, and the two things Settings can do about it. */
export interface StorageLocation {
  path: string;
  showInFolder(): Promise<void>;
  /** Opens the native folder dialog; `changed` means the app was pointed at another library and the page is reloading, `cancelled` that nothing changed, `refused` that the folder cannot be a library (the reason, for Settings to show). */
  change(): Promise<'changed' | 'cancelled' | { refused: string }>;
}

export interface StorageEstimate {
  usedBytes: number;
  quotaBytes: number;
}

const MIB = 1024 * 1024;
const LOW_FREE_BYTES = 200 * MIB;
const LOW_USED_FRACTION = 0.9;

interface StorageHealthOperations {
  requestPersistence(): Promise<boolean>;
  estimateStorage(): Promise<StorageEstimate | null>;
}

/** The browser's persistent-storage request and usage estimate; a browser without them, or a call that throws, gives false and null. */
export function createStorageOperations(storage: StorageManagerLike | undefined): StorageHealthOperations {
  let answer: boolean | undefined; // the browser's first answer; asking again could prompt the user twice
  return {
    async requestPersistence() {
      if (answer !== undefined) return answer;
      try {
        if (storage?.persist === undefined) return false;
        if (storage.persisted !== undefined && (await storage.persisted())) return (answer = true);
        return (answer = await storage.persist());
      } catch {
        return false;
      }
    },
    async estimateStorage() {
      try {
        if (storage?.estimate === undefined) return null;
        const { usage, quota } = await storage.estimate();
        if (quota === undefined || !(quota > 0)) return null;
        return { usedBytes: usage ?? 0, quotaBytes: quota };
      } catch {
        return null;
      }
    },
  };
}

/** True when under 200 MiB is free or 90% or more of the quota is used; an estimate the browser could not give is never low. */
export function isStorageLow(estimate: StorageEstimate | null): boolean {
  if (estimate === null) return false;
  return estimate.quotaBytes - estimate.usedBytes < LOW_FREE_BYTES || estimate.usedBytes >= estimate.quotaBytes * LOW_USED_FRACTION;
}
