import { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { discoverModels } from '../../generation';
import { KeyPasswordPrompts, KeyVault, usePasswordPrompt } from '../../keys';
import type { AppBackends, ResolvedBackends } from './appBackends';

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
  const [keys] = useState(
    () =>
      new KeyVault({
        storage: backends.vaultStorage,
        requestPassword: prompt.requestPassword,
        ...(backends.appId === undefined ? {} : { appId: backends.appId }),
        ...(backends.kdfIterations === undefined ? {} : { kdfIterations: backends.kdfIterations }),
      }),
  );
  const [keysLoaded, setKeysLoaded] = useState(false);
  useEffect(() => {
    let live = true;
    void keys.refresh().then(() => {
      if (live) setKeysLoaded(true);
    });
    return () => {
      live = false;
    };
  }, [keys]);

  const discover = backends.discoverModels ?? discoverModels;
  const { answer, refuseRequests } = prompt;
  const value = useMemo<ResolvedBackends>(
    () => ({ createImageGenerator: backends.createImageGenerator, createPromptEnhancer: backends.createPromptEnhancer, discoverModels: discover, keys, passwordPrompt: { answer, refuseRequests }, keysLoaded }),
    [backends.createImageGenerator, backends.createPromptEnhancer, discover, keys, answer, refuseRequests, keysLoaded],
  );
  return (
    <BackendsContext.Provider value={value}>
      {children}
      <KeyPasswordPrompts vault={keys} prompt={prompt} />
    </BackendsContext.Provider>
  );
}

export function useAppBackends(): ResolvedBackends {
  const value = useContext(BackendsContext);
  if (value === null) throw new Error('useAppBackends needs an AppBackendsProvider above it.');
  return value;
}
