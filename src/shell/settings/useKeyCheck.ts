import { useCallback, useEffect, useRef, useState } from 'react';
import type { discoverModels } from '../../generation';
import { PROVIDERS, type KeyVault, type Provider } from '../../keys';
import { describeRejectedKey } from './describeRejectedKey';

export type RejectedKeyFlags = Partial<Record<Provider, string>>;

export interface KeyCheckState {
  flags: RejectedKeyFlags; // providers whose key was just refused, with the line to show
  keySaved(provider: Provider): void; // call after the vault accepted a key; checks it once
}

/**
 * Settings R4: after a key is saved, asks that provider for its models once; a refusal flags the key. Flags live in memory while the
 * Settings page is open. A lock keeps them; removing the key clears its flag. Nothing is checked on unlock, reload or mount.
 */
export function useKeyCheck(vault: Pick<KeyVault, 'status' | 'hasKey' | 'getKey' | 'on'>, discover: typeof discoverModels): KeyCheckState {
  const [flags, setFlags] = useState<RejectedKeyFlags>({});
  const runs = useRef<Record<Provider, number>>({ gemini: 0, openai: 0 }); // the latest check of each provider; an older answer is dropped
  const calls = useRef<Partial<Record<Provider, AbortController>>>({});
  const mounted = useRef(true); // the key section may finish a save after the Settings view was left

  const forget = useCallback((provider: Provider): void => {
    runs.current[provider] += 1;
    calls.current[provider]?.abort();
    delete calls.current[provider];
    setFlags((current) => {
      if (current[provider] === undefined) return current;
      const rest = { ...current };
      delete rest[provider];
      return rest;
    });
  }, []);

  useEffect(() => {
    const calling = calls.current;
    mounted.current = true;
    const stopListening = vault.on('status-changed', () => {
      for (const provider of PROVIDERS) if (vault.status() === 'none' || !vault.hasKey(provider)) forget(provider);
    });
    return () => {
      mounted.current = false;
      stopListening();
      for (const provider of PROVIDERS) calling[provider]?.abort();
    };
  }, [vault, forget]);

  const keySaved = useCallback(
    (provider: Provider): void => {
      if (!mounted.current) return;
      forget(provider);
      const key = vault.getKey(provider);
      if (key === null) return;
      const mine = runs.current[provider];
      const call = new AbortController();
      calls.current[provider] = call;
      void discover(provider, key, call.signal)
        .then((result) => {
          if (call.signal.aborted || mine !== runs.current[provider] || !vault.hasKey(provider)) return;
          const now = vault.getKey(provider);
          if (now !== null && now !== key) return; // another tab replaced the key since: this answer is about the old one
          const flag = describeRejectedKey(provider, result);
          if (flag !== null) setFlags((current) => ({ ...current, [provider]: flag }));
        })
        .catch(() => undefined);
    },
    [vault, discover, forget],
  );

  return { flags, keySaved };
}
