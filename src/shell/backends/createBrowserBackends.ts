import { createImageGenerator, createPromptEnhancer } from '../../generation';
import { createIndexedDbVaultStorage } from '../../keys';
import type { AppBackends } from './appBackends';

/** The real providers (browser fetch) and the key vault in this browser's IndexedDB; an `appId` gives the vault that app's own names (appId R1). */
export function createBrowserBackends(appId?: string): AppBackends {
  return {
    createImageGenerator: (provider) => createImageGenerator(provider),
    createPromptEnhancer: (provider) => createPromptEnhancer(provider),
    vaultStorage: createIndexedDbVaultStorage(undefined, appId),
    ...(appId === undefined ? {} : { appId }),
  };
}
