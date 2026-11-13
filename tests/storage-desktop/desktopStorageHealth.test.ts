import { describe, expect, it } from 'vitest';
import { createStorageOperations, isStorageLow } from '../../src/projects';
import { createDesktopStorageHealth } from '../../src/storage-desktop/desktopStorageHealth';
import type { FileBridge } from '../../src/storage-desktop/FileBridge';

const MIB = 1024 * 1024;
const GIB = 1024 * MIB;
const bridgeWith = (space: { free: number; total: number } | null): FileBridge => ({ freeSpace: async () => space }) as unknown as FileBridge;
const operations = (space: { free: number; total: number } | null) => createStorageOperations(createDesktopStorageHealth(bridgeWith(space)));

describe('desktop storage health (storage-backends R10)', () => {
  it('R10 persistence is always granted, as a disk folder is not cleared by the system', async () => {
    expect(await operations({ free: GIB, total: 2 * GIB }).requestPersistence()).toBe(true);
  });

  it('R10 the estimate reports the free space as the room left, so a nearly full disk alone does not trip the 90% rule', async () => {
    const estimate = await operations({ free: 50 * GIB, total: 500 * GIB }).estimateStorage();
    expect(estimate).toEqual({ usedBytes: 0, quotaBytes: 50 * GIB });
    expect(isStorageLow(estimate)).toBe(false);
  });

  it('R10 under 200 MiB free counts as low, at 200 MiB it does not', async () => {
    expect(isStorageLow(await operations({ free: 199 * MIB, total: 500 * GIB }).estimateStorage())).toBe(true);
    expect(isStorageLow(await operations({ free: 200 * MIB, total: 500 * GIB }).estimateStorage())).toBe(false);
  });

  it('R10 when the disk will not say, there is no estimate and it is never low', async () => {
    const estimate = await operations(null).estimateStorage();
    expect(estimate).toBeNull();
    expect(isStorageLow(estimate)).toBe(false);
  });

  it('R10 a failing free-space call gives no estimate instead of an error', async () => {
    const failing = { freeSpace: () => Promise.reject(new Error('x')) } as unknown as FileBridge;
    expect(await createStorageOperations(createDesktopStorageHealth(failing)).estimateStorage()).toBeNull();
  });
});
