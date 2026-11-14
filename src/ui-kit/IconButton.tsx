import type { ReactNode } from 'react';
import { Spinner } from './Spinner';
import './IconButton.css';

interface IconButtonProps {
  label: string; // the accessible name and the tooltip
  hint?: string; // a longer tooltip in place of the label (a summary shown on hover); the accessible name stays the label
  icon: ReactNode;
  pressed?: boolean; // for a toggle: reported as aria-pressed and drawn selected
  expanded?: boolean; // for a button that opens a panel: reported as aria-expanded and drawn selected while it is open
  disabled?: boolean;
  disabledReason?: string; // why it is disabled: added to the tooltip and given as the description
  loading?: boolean; // ignores clicks, shows a spinner, announced as busy
  compact?: boolean; // a small round badge for a corner of something else, such as the remove mark on a thumbnail
  untitled?: boolean; // no native title: a Tooltip around the button says it instead (the accessible name stays the label)
  onClick: () => void;
  testId?: string; // a stable hook for the end-to-end tests
}

export function IconButton({ label, hint, icon, pressed, expanded, disabled = false, disabledReason, loading = false, compact = false, untitled = false, onClick, testId }: IconButtonProps): React.JSX.Element {
  const reason = disabled ? disabledReason : undefined;
  return (
    <button
      type="button"
      className="ui-icon-button"
      aria-label={label}
      aria-description={reason}
      aria-busy={loading ? true : undefined}
      title={untitled ? undefined : reason === undefined ? (hint ?? label) : `${label}: ${reason}`}
      aria-pressed={pressed}
      aria-expanded={expanded}
      data-pressed={pressed || expanded ? '' : undefined}
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
