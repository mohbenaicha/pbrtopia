import { useState } from 'react';
import { keyFailure } from '../keyError';
import type { KeyVault } from '../KeyVault';
import { ForgotPasswordDialog } from './ForgotPasswordDialog';
import { PasswordDialog } from './PasswordDialog';
import type { PasswordPrompt } from './usePasswordPrompt';

export interface KeyPasswordPromptsProps {
  vault: KeyVault;
  prompt: PasswordPrompt;
}

// R3, R6: the password dialog the vault asks for, and the confirmation behind its "Forgot password" link.
export function KeyPasswordPrompts({ vault, prompt }: KeyPasswordPromptsProps): React.JSX.Element {
  const [forgetting, setForgetting] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [failure, setFailure] = useState<string | null>(null);

  const closeForgetting = (): void => {
    setForgetting(false);
    setFailure(null);
  };

  const deleteSavedKeys = async (): Promise<void> => {
    setDeleting(true);
    setFailure(null);
    // The vault is waiting for this answer inside its queue, so it is cancelled first: the delete runs after it. Changes queued
    // behind it would ask again, so no question is opened until the delete is over; they end as cancelled.
    prompt.refuseRequests(true);
    prompt.answer(null);
    try {
      await vault.wipe();
      closeForgetting();
    } catch (error) {
      setFailure(error instanceof Error ? error.message : keyFailure('storage-failed').error.message);
    } finally {
      prompt.refuseRequests(false);
      setDeleting(false);
    }
  };

  return (
    <>
      <PasswordDialog
        purpose={forgetting ? null : prompt.purpose}
        onAnswer={prompt.answer}
        onForgotPassword={() => setForgetting(true)}
      />
      <ForgotPasswordDialog open={forgetting} busy={deleting} error={failure} onCancel={closeForgetting} onConfirm={() => void deleteSavedKeys()} />
    </>
  );
}
