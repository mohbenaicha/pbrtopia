import { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { discoverModels } from '../../generation';
import { EnvKeyChoices, KeyPasswordPrompts, KeyVault, ProviderKeySource, createEnvChoiceChannel, createLocalEnvChoiceStorage, usePasswordPrompt } from '../../keys';
import type { AppBackends, DesktopPickers, ResolvedBackends } from './appBackends';

const BackendsContext = createContext<ResolvedBackends | null>(null);

interface AppBackendsProviderProps {
  backends: AppBackends;
  children: React.ReactNode;
}

/**
 * Builds the key vault once (its password request comes from the dialog hook, so the vault and the dialogs are made together),
 * reads the stored vault once so the key flags are known while it is locked, and mounts the password dialogs (generate R20, R21).
 */
export function AppBackendsProvider({ backends, children }: AppBackendsProviderProps): React.JSX.Element {
  const prompt = usePasswordPrompt();
  const [vault] = useState(
    () =>
      new KeyVault({
        storage: backends.vaultStorage,
        requestPassword: prompt.requestPassword,
        ...(backends.appId === undefined ? {} : { appId: backends.appId }),
        ...(backends.kdfIterations === undefined ? {} : { kdfIterations: backends.kdfIterations }),
      }),
  );
  const [envChoices] = useState(() => new EnvKeyChoices({ storage: createLocalEnvChoiceStorage(backends.appId), channel: createEnvChoiceChannel(backends.appId) }));
  const [keys] = useState(() => new ProviderKeySource({ vault, choices: envChoices, env: backends.envKeySource }));
  const [keysLoaded, setKeysLoaded] = useState(false);
  useEffect(() => {
    let live = true;
    void Promise.all([vault.refresh(), keys.detectEnvSupport()]).then(() => {
      if (live) setKeysLoaded(true);
    });
    return () => {
      live = false;
    };
  }, [vault, keys]);

  const discover = backends.discoverModels ?? discoverModels;
  const { answer, refuseRequests } = prompt;
  const value = useMemo<ResolvedBackends>(
    () => ({
      createImageGenerator: backends.createImageGenerator,
      createPromptEnhancer: backends.createPromptEnhancer,
      discoverModels: discover,
      keys,
      vault,
      envChoices,
      passwordPrompt: { answer, refuseRequests },
      keysLoaded,
      ...(backends.location === undefined ? {} : { location: backends.location }),
      ...(backends.pickers === undefined ? {} : { pickers: backends.pickers }),
    }),
    [backends.createImageGenerator, backends.createPromptEnhancer, backends.location, backends.pickers, discover, keys, vault, envChoices, answer, refuseRequests, keysLoaded],
  );
  return (
    <BackendsContext.Provider value={value}>
      {children}
      <KeyPasswordPrompts vault={vault} prompt={prompt} />
    </BackendsContext.Provider>
  );
}

/** The desktop dialogs the exports use, or undefined in the browser and wherever no provider is mounted (storage-backends R13). */
export function useDesktopPickers(): DesktopPickers | undefined {
  return useContext(BackendsContext)?.pickers;
}

/** True in the desktop app (the library's place is known), false in the browser and wherever no provider is mounted (storage-backends R10). */
export function useIsDesktopApp(): boolean {
  return useContext(BackendsContext)?.location !== undefined;
}

export function useAppBackends(): ResolvedBackends {
  const value = useContext(BackendsContext);
  if (value === null) throw new Error('useAppBackends needs an AppBackendsProvider above it.');
  return value;
}

/** Reads whether the host can read the environment (false in the hosted web app and wherever no provider is mounted); the guided tour uses it to skip a step the host cannot show (tutorial R23). */
export function useEnvKeysOffered(): () => boolean {
  const value = useContext(BackendsContext);
  return () => value?.keys.envOffered() ?? false;
}
