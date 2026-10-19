import { useState } from 'react';
import { keyFailure } from '../keyError';
import type { KeyVault } from '../KeyVault';
import type { PasswordPrompt } from './usePasswordPrompt';

export interface DeleteSavedKeys {
  deleting: boolean;
  failure: string | null; // why the last delete failed
  deleteSavedKeys: () => Promise<boolean>; // true when the saved keys are gone
  clearFailure: () => void;
}

// R6: deletes the stored vault for a confirmation dialog (Forgot password, Reset saved keys). A password question the vault is waiting
// on is cancelled first, so the delete does not wait behind it; changes queued behind the delete would ask again, so no question is
// opened until the delete is over, and they end as cancelled.
export function useDeleteSavedKeys(vault: KeyVault, prompt: PasswordPrompt): DeleteSavedKeys {
  const [deleting, setDeleting] = useState(false);
  const [failure, setFailure] = useState<string | null>(null);

  const deleteSavedKeys = async (): Promise<boolean> => {
    setDeleting(true);
    setFailure(null);
    prompt.refuseRequests(true);
    prompt.answer(null);
    try {
      await vault.wipe();
      return true;
    } catch (error) {
      setFailure(error instanceof Error ? error.message : keyFailure('storage-failed').error.message);
      return false;
    } finally {
      prompt.refuseRequests(false);
      setDeleting(false);
    }
  };

  return { deleting, failure, deleteSavedKeys, clearFailure: () => setFailure(null) };
}
