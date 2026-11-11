import type { SharedProjectStore } from '../projects/SharedProjectStore';
import type { StoreResult } from '../projects/storeError';

type MemoryStore = Pick<SharedProjectStore, 'saveAppSettings'>;

/** Makes the project the one the app reopens at the next start (projects R5). */
export const rememberOpenProject = (store: MemoryStore, projectId: string): Promise<StoreResult<void>> => store.saveAppSettings({ lastOpenProjectId: projectId });

/** Leaves no project to reopen, so the next start lands on the list. */
export const forgetOpenProject = (store: MemoryStore): Promise<StoreResult<void>> => store.saveAppSettings({ lastOpenProjectId: null });
