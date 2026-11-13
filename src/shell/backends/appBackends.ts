import type { discoverModels, ImageGenerator, PromptEnhancer } from '../../generation';
import type { KeyVault, PasswordPromptControls, Provider, VaultStorage } from '../../keys';
import type { StorageLocation } from '../../projects';
import type { DownloadEnvironment } from '../saveZipFile';
import type { FolderEnvironment } from '../saveZipsToFolder';

/** What the app is started with (generate R21): the provider adapters and where the key vault lives. A test passes fakes; there is no other switch. */
export interface AppBackends {
  createImageGenerator: (provider: Provider) => ImageGenerator;
  createPromptEnhancer: (provider: Provider) => PromptEnhancer;
  vaultStorage: VaultStorage;
  appId?: string; // names the vault's sealed data and channel; none = the projection app's own names
  kdfIterations?: number;
  discoverModels?: typeof discoverModels; // asks a provider which models a key can use (the panel feed, the key check, Refresh); the real call when absent
  location?: StorageLocation; // desktop mode only (storage-backends R10): where the library folder is; the Storage section shows its lines when this is set
  pickers?: DesktopPickers; // desktop mode only (storage-backends R12, R13): the native Save and folder dialogs the exports use in place of the browser's pickers
}

/** The dialogs Rust opens, in the shape of the browser's file pickers, so the zip writers use them unchanged (storage-backends R13). */
export interface DesktopPickers {
  showSaveFilePicker: NonNullable<DownloadEnvironment['showSaveFilePicker']>;
  showDirectoryPicker: NonNullable<FolderEnvironment['showDirectoryPicker']>;
}

/** What the views read through `useAppBackends`: the same factories and the one key vault the provider built. */
export interface ResolvedBackends {
  createImageGenerator: AppBackends['createImageGenerator'];
  createPromptEnhancer: AppBackends['createPromptEnhancer'];
  discoverModels: typeof discoverModels;
  keys: KeyVault;
  passwordPrompt: PasswordPromptControls; // the vault's password question; the key section cancels it through this before a reset
  location?: StorageLocation; // desktop mode only (storage-backends R10)
  pickers?: DesktopPickers; // desktop mode only (storage-backends R13)
  keysLoaded: boolean; // the stored vault has been read once, so `keys.hasKey` can be trusted while it is locked
}
