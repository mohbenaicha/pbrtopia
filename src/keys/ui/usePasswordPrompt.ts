import { useCallback, useRef, useState } from 'react';
import type { PasswordAnswer, PasswordRequest } from '../vaultTypes';

export type PasswordPurpose = 'unlock' | 'create';

export interface PasswordPrompt {
  requestPassword: PasswordRequest; // what the KeyVault is given; same function on every render
  purpose: PasswordPurpose | null; // what is being asked now, null when nothing is
  answer: (answer: PasswordAnswer | null) => void; // what the dialog calls; null = cancelled
}

// R3: turns the vault's "ask for a password" call into dialog state. One question at a time; a new request cancels the open one.
export function usePasswordPrompt(): PasswordPrompt {
  const [purpose, setPurpose] = useState<PasswordPurpose | null>(null);
  const pending = useRef<((answer: PasswordAnswer | null) => void) | null>(null);

  const requestPassword = useCallback<PasswordRequest>((asked) => {
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

  return { requestPassword, purpose, answer };
}
