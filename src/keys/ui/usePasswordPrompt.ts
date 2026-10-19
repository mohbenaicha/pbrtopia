import { useCallback, useEffect, useRef, useState } from 'react';
import type { PasswordAnswer, PasswordRequest } from '../vaultTypes';

export type PasswordPurpose = 'unlock' | 'create';

export interface PasswordPrompt {
  requestPassword: PasswordRequest; // what the KeyVault is given; same function on every render
  purpose: PasswordPurpose | null; // what is being asked now, null when nothing is
  answer: (answer: PasswordAnswer | null) => void; // what the dialog calls; null = cancelled
  refuseRequests: (refuse: boolean) => void; // while true, every request is answered null without opening a dialog
}

// R3: turns the vault's "ask for a password" call into dialog state. One question at a time; a new request cancels the open one,
// and a question still open when the component goes away is answered null so the vault is not left waiting.
export function usePasswordPrompt(): PasswordPrompt {
  const [purpose, setPurpose] = useState<PasswordPurpose | null>(null);
  const pending = useRef<((answer: PasswordAnswer | null) => void) | null>(null);
  const refusing = useRef(false);

  useEffect(
    () => () => {
      pending.current?.(null);
      pending.current = null;
    },
    [],
  );

  const requestPassword = useCallback<PasswordRequest>((asked) => {
    if (refusing.current) return Promise.resolve(null);
    pending.current?.(null);
    return new Promise<PasswordAnswer | null>((resolve) => {
      pending.current = resolve;
      setPurpose(asked);
    });
  }, []);

  const answer = useCallback((given: PasswordAnswer | null) => {
    const resolve = pending.current;
    pending.current = null;
    setPurpose(null);
    resolve?.(given);
  }, []);

  const refuseRequests = useCallback((refuse: boolean) => {
    refusing.current = refuse;
  }, []);

  return { requestPassword, purpose, answer, refuseRequests };
}
