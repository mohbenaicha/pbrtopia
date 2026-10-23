import type { ReactNode } from 'react';
import './IconButton.css';

interface IconButtonProps {
  label: string; // the accessible name and the tooltip
  icon: ReactNode;
  pressed?: boolean; // for a toggle: reported as aria-pressed and drawn selected
  disabled?: boolean;
  onClick: () => void;
  testId?: string; // a stable hook for the end-to-end tests
}

export function IconButton({ label, icon, pressed, disabled = false, onClick, testId }: IconButtonProps): React.JSX.Element {
  return (
    <button type="button" className="ui-icon-button" aria-label={label} title={label} aria-pressed={pressed} data-pressed={pressed ? '' : undefined} data-testid={testId} disabled={disabled} onClick={onClick}>
      {icon}
    </button>
  );
}
