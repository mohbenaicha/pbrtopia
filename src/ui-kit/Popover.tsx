import { useRef, type ReactNode } from 'react';
import { useDismiss } from './useDismiss';
import './Popover.css';

interface PopoverProps {
  open: boolean;
  onClose: () => void; // Escape or a click outside the trigger and panel
  closeOnOutsideClick?: boolean; // false: only Escape closes it (and the caller's own trigger), so a stray click cannot end work in progress
  label: string; // accessible name of the panel
  trigger: ReactNode;
  children: ReactNode;
}

// A small panel anchored under its trigger. The caller owns open/closed; clicks on the trigger are the caller's to handle.
export function Popover({ open, onClose, closeOnOutsideClick = true, label, trigger, children }: PopoverProps): React.JSX.Element {
  const region = useRef<HTMLDivElement>(null);
  useDismiss(open, region, onClose, closeOnOutsideClick);
  return (
    <div className="ui-popover" ref={region}>
      {trigger}
      {open && (
        <div className="ui-popover__panel" role="dialog" aria-label={label}>
          {children}
        </div>
      )}
    </div>
  );
}
