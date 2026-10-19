import { useState } from 'react';
import type { KeyVault } from '../KeyVault';
import { ForgotPasswordDialog } from './ForgotPasswordDialog';
import { PasswordDialog } from './PasswordDialog';
import { useDeleteSavedKeys } from './useDeleteSavedKeys';
import type { PasswordPrompt } from './usePasswordPrompt';

export interface KeyPasswordPromptsProps {
  vault: KeyVault;
  prompt: PasswordPrompt;
}

// R3, R6: the password dialog the vault asks for, and the confirmation behind its "Forgot password" link.
export function KeyPasswordPrompts({ vault, prompt }: KeyPasswordPromptsProps): React.JSX.Element {
  const [forgetting, setForgetting] = useState(false);
  const { deleting, failure, deleteSavedKeys, clearFailure } = useDeleteSavedKeys(vault, prompt);

  const closeForgetting = (): void => {
    setForgetting(false);
    clearFailure();
  };

  const confirmDelete = async (): Promise<void> => {
    if (await deleteSavedKeys()) closeForgetting();
  };

  return (
    <>
      <PasswordDialog
        purpose={forgetting ? null : prompt.purpose}
        onAnswer={prompt.answer}
        onForgotPassword={() => setForgetting(true)}
      />
      <ForgotPasswordDialog open={forgetting} busy={deleting} error={failure} onCancel={closeForgetting} onConfirm={() => void confirmDelete()} />
    </>
  );
}
