import { createImageGenerator, createPromptEnhancer } from '../../generation';
import { createIndexedDbVaultStorage } from '../../keys';
import type { AppBackends } from './appBackends';
import { createLauncherEnvKeySource } from './launcherEnvKeySource';

/** The real providers (browser fetch) and the key vault in this browser's IndexedDB; an `appId` gives the vault that app's own names (appId R1). The launcher's environment reader is offered; it answers "not available" anywhere but the offline launcher (api-keys R21). */
export function createBrowserBackends(appId?: string): AppBackends {
  return {
    createImageGenerator: (provider) => createImageGenerator(provider),
    createPromptEnhancer: (provider) => createPromptEnhancer(provider),
    vaultStorage: createIndexedDbVaultStorage(undefined, appId),
    envKeySource: createLauncherEnvKeySource(),
    ...(appId === undefined ? {} : { appId }),
  };
}
