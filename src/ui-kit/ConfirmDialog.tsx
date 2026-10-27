import type { ReactNode } from 'react';
import { Button } from './Button';
import { Dialog } from './Dialog';

interface ConfirmDialogProps {
  open: boolean;
  title: string;
  confirmLabel: string; // the danger button, e.g. "Delete"
  busy: boolean; // the confirmed action is running: the button is busy and the dialog cannot be closed
  status?: string; // progress text announced while busy
  onConfirm: () => void;
  onCancel: () => void;
  children?: ReactNode; // what will happen
}

// Asks before something that cannot be undone. Cancel comes first so it has the focus.
export function ConfirmDialog({ open, title, confirmLabel, busy, status, onConfirm, onCancel, children }: ConfirmDialogProps): React.JSX.Element {
  return (
    <Dialog
      open={open}
      title={title}
      onClose={onCancel}
      dismissible={!busy}
      actions={
        <>
          <Button variant="ghost" disabled={busy} onClick={onCancel}>Cancel</Button>
          <Button variant="danger" loading={busy} onClick={onConfirm}>{confirmLabel}</Button>
        </>
      }
    >
      {children}
      {busy && status !== undefined && <p role="status">{status}</p>}
    </Dialog>
  );
}
