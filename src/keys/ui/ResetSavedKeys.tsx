import { useState } from 'react';
import { Button } from '../../ui-kit';
import { ForgotPasswordDialog } from './ForgotPasswordDialog';
import type { DeleteSavedKeys } from './useDeleteSavedKeys';
import './keysUi.css';

interface ResetSavedKeysProps {
  problem: string | null; // why the stored vault could not be read; null once it reads again while a delete is still running
  deletion: DeleteSavedKeys;
}

// R6: shown when the stored vault cannot be read at all, so there is no password to ask for: says so and offers to start again.
export function ResetSavedKeys({ problem, deletion }: ResetSavedKeysProps): React.JSX.Element {
  const [confirming, setConfirming] = useState(false);

  const close = (): void => {
    setConfirming(false);
    deletion.clearFailure();
  };

  const confirmDelete = async (): Promise<void> => {
    if (await deletion.deleteSavedKeys()) close();
  };

  return (
    <div className="key-reset">
      {problem !== null && <p className="key-row__problem" role="alert">{problem}</p>}
      {problem !== null && <Button onClick={() => setConfirming(true)}>Reset saved keys</Button>}
      <ForgotPasswordDialog
        open={confirming}
        busy={deletion.deleting}
        error={deletion.failure}
        onCancel={close}
        onConfirm={() => void confirmDelete()}
        title="Reset saved keys?"
        text="The saved keys cannot be read, so they cannot be used. Deleting them lets you start again with new keys and a new password."
      />
    </div>
  );
}
