import { useEffect, useId, useRef, type KeyboardEvent, type ReactNode } from 'react';
import { useDismiss } from './useDismiss';
import './Dialog.css';

export interface DialogProps {
  open: boolean;
  title: string;
  onClose: () => void;
  actions?: ReactNode; // the buttons along the bottom
  dismissible?: boolean; // Escape and a click outside close it; false for dialogs that must be answered
  children?: ReactNode;
}

const FOCUSABLE = 'button:not(:disabled), input:not(:disabled), select:not(:disabled), textarea:not(:disabled), [href], [tabindex]:not([tabindex="-1"])';

// A modal over a dimmed page. Focus moves in on open, cycles inside on Tab, and goes back to where it was on close.
export function Dialog({ open, title, onClose, actions, dismissible = true, children }: DialogProps): React.JSX.Element | null {
  const titleId = useId();
  const dialog = useRef<HTMLDivElement>(null);
  useDismiss(open && dismissible, dialog, onClose);

  useEffect(() => {
    if (!open) return undefined;
    const opener = document.activeElement as HTMLElement | null;
    (dialog.current?.querySelector<HTMLElement>(FOCUSABLE) ?? dialog.current)?.focus();
    return () => opener?.focus();
  }, [open]);

  if (!open) return null;

  const keepFocusInside = (event: KeyboardEvent<HTMLDivElement>): void => {
    if (event.key !== 'Tab' || !dialog.current) return;
    const items = Array.from(dialog.current.querySelectorAll<HTMLElement>(FOCUSABLE));
    const first = items[0];
    const last = items[items.length - 1];
    if (!first || !last) {
      event.preventDefault();
      dialog.current.focus();
    } else if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  };

  return (
    <div className="ui-dialog__backdrop">
      <div className="ui-dialog" role="dialog" aria-modal="true" aria-labelledby={titleId} tabIndex={-1} ref={dialog} onKeyDown={keepFocusInside}>
        <h2 className="ui-dialog__title" id={titleId}>{title}</h2>
        <div className="ui-dialog__body">{children}</div>
        {actions && <div className="ui-dialog__actions">{actions}</div>}
      </div>
    </div>
  );
}
