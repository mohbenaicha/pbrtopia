import type { ReactNode } from 'react';
import './IconButton.css';

export interface IconButtonProps {
  label: string; // the accessible name and the tooltip
  icon: ReactNode;
  pressed?: boolean; // for a toggle: reported as aria-pressed and drawn selected
  disabled?: boolean;
  onClick: () => void;
}

export function IconButton({ label, icon, pressed, disabled = false, onClick }: IconButtonProps): React.JSX.Element {
  return (
    <button type="button" className="ui-icon-button" aria-label={label} title={label} aria-pressed={pressed} data-pressed={pressed ? '' : undefined} disabled={disabled} onClick={onClick}>
      {icon}
    </button>
  );
}
