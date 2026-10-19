import { Button, Dialog } from '../../ui-kit';
import './keysUi.css';

export interface ForgotPasswordDialogProps {
  open: boolean;
  busy: boolean;
  error: string | null; // why the keys could not be deleted
  onCancel: () => void;
  onConfirm: () => void;
  title?: string;
  text?: string;
}

const FORGOT_TITLE = 'Forget your password?';
const FORGOT_TEXT = 'The password cannot be recovered. Deleting the saved keys lets you start again with new keys and a new password.';

// R6: a forgotten password cannot be recovered, so the only way on is to delete the saved keys; this asks first. Cancel has focus.
// Also used to reset a stored vault that cannot be read, with its own title and text.
export function ForgotPasswordDialog({ open, busy, error, onCancel, onConfirm, title = FORGOT_TITLE, text = FORGOT_TEXT }: ForgotPasswordDialogProps): React.JSX.Element | null {
  const actions = (
    <>
      <Button onClick={onCancel} disabled={busy}>Cancel</Button>
      <Button variant="danger" loading={busy} onClick={onConfirm}>Delete saved keys</Button>
    </>
  );
  return (
    <Dialog open={open} title={title} onClose={onCancel} actions={actions} dismissible={!busy}>
      <div className="key-dialog__form">
        <p className="key-dialog__text">{text}</p>
        {error && <p className="key-dialog__error" role="alert">{error}</p>}
      </div>
    </Dialog>
  );
}
