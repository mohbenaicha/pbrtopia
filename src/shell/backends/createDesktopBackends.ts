import { createImageGenerator, createPromptEnhancer } from '../../generation';
import type { VaultStorage } from '../../keys';
import type { StorageLocation } from '../../projects';
import type { AppBackends, DesktopPickers } from './appBackends';

/** What the desktop side supplies to the backends: where the vault lives, where the library is, and the native dialogs. */
export interface DesktopBackendParts {
  vaultStorage: VaultStorage;
  location: StorageLocation;
  pickers: DesktopPickers;
}

/** The real providers (the window's own fetch) with the key vault in the app's data folder, the library's place for Settings and the native export dialogs (storage-backends R5, R10, R13); an `appId` gives the vault that app's own names. */
export function createDesktopBackends(parts: DesktopBackendParts, appId?: string): AppBackends {
  return {
    createImageGenerator: (provider) => createImageGenerator(provider),
    createPromptEnhancer: (provider) => createPromptEnhancer(provider),
    vaultStorage: parts.vaultStorage,
    location: parts.location,
    pickers: parts.pickers,
    ...(appId === undefined ? {} : { appId }),
  };
}
