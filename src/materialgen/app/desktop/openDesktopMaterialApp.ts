import type { StoreResult } from '@shared/projects';
import { createDesktopBackends, type AppBackends } from '@shared/shell';
import { openDesktopParts, storeFailureFromLibraryOpen, type DesktopOptions } from '@shared/storage-desktop';
import { createDesktopMaterialDatabase, createMaterialStore, type MaterialProjectStore } from '@mat/storage';
import { APP_ID } from '../appIdentity';

export interface DesktopMaterialApp {
  store: MaterialProjectStore;
  backends: AppBackends;
}

/**
 * Storage-backends R1, R4, R15: the material app on the desktop backend, under its own vault names. The same material store as in the browser,
 * over the SQLite library and its files. A library that cannot be opened comes back as the store error the entry draws.
 */
export async function openDesktopMaterialApp(options: DesktopOptions = {}): Promise<StoreResult<DesktopMaterialApp>> {
  try {
    const parts = await openDesktopParts(options);
    const store = createMaterialStore({ database: createDesktopMaterialDatabase(parts.engine), blobs: parts.blobs, storage: parts.storage });
    return { ok: true, value: { store, backends: createDesktopBackends(parts, APP_ID) } };
  } catch (error) {
    return storeFailureFromLibraryOpen(error);
  }
}
