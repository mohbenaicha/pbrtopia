import type { discoverModels, ImageGenerator, PromptEnhancer } from '../../generation';
import type { KeyVault, PasswordPromptControls, Provider, VaultStorage } from '../../keys';

/** What the app is started with (generate R21): the provider adapters and where the key vault lives. A test passes fakes; there is no other switch. */
export interface AppBackends {
  createImageGenerator: (provider: Provider) => ImageGenerator;
  createPromptEnhancer: (provider: Provider) => PromptEnhancer;
  vaultStorage: VaultStorage;
  appId?: string; // names the vault's sealed data and channel; none = the projection app's own names
  kdfIterations?: number;
  discoverModels?: typeof discoverModels; // asks a provider which models a key can use (the panel feed, the key check, Refresh); the real call when absent
}

/** What the views read through `useAppBackends`: the same factories and the one key vault the provider built. */
export interface ResolvedBackends {
  createImageGenerator: AppBackends['createImageGenerator'];
  createPromptEnhancer: AppBackends['createPromptEnhancer'];
  discoverModels: typeof discoverModels;
  keys: KeyVault;
  passwordPrompt: PasswordPromptControls; // the vault's password question; the key section cancels it through this before a reset
  keysLoaded: boolean; // the stored vault has been read once, so `keys.hasKey` can be trusted while it is locked
}
