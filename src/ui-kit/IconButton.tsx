import type { ReactNode } from 'react';
import { Spinner } from './Spinner';
import './IconButton.css';

interface IconButtonProps {
  label: string; // the accessible name and the tooltip
  icon: ReactNode;
  pressed?: boolean; // for a toggle: reported as aria-pressed and drawn selected
  disabled?: boolean;
  disabledReason?: string; // why it is disabled: added to the tooltip and given as the description
  loading?: boolean; // ignores clicks, shows a spinner, announced as busy
  compact?: boolean; // a small round badge for a corner of something else, such as the remove mark on a thumbnail
  onClick: () => void;
  testId?: string; // a stable hook for the end-to-end tests
}

export function IconButton({ label, icon, pressed, disabled = false, disabledReason, loading = false, compact = false, onClick, testId }: IconButtonProps): React.JSX.Element {
  const reason = disabled ? disabledReason : undefined;
  return (
    <button
      type="button"
      className="ui-icon-button"
      aria-label={label}
      aria-description={reason}
      aria-busy={loading ? true : undefined}
      title={reason === undefined ? label : `${label}: ${reason}`}
      aria-pressed={pressed}
      data-pressed={pressed ? '' : undefined}
      data-compact={compact ? '' : undefined}
      data-testid={testId}
      disabled={disabled}
      onClick={() => {
        if (!loading) onClick();
      }}
    >
      {loading ? <Spinner decorative /> : icon}
    </button>
  );
}
