import type { ReactNode } from 'react';
import { Spinner } from './Spinner';
import { Tooltip } from './Tooltip';
import './IconButton.css';

interface IconButtonProps {
  label: string; // the accessible name and the tooltip
  hint?: string; // the tooltip's text under the label as its heading (what the button does); also its accessible description
  icon: ReactNode;
  pressed?: boolean; // for a toggle: reported as aria-pressed and drawn selected
  expanded?: boolean; // for a button that opens a panel: reported as aria-expanded and drawn selected while it is open
  disabled?: boolean;
  disabledReason?: string; // why it is disabled: added to the tooltip and given as the description
  loading?: boolean; // ignores clicks, shows a spinner, announced as busy
  compact?: boolean; // a small round badge for a corner of something else, such as the remove mark on a thumbnail
  untitled?: boolean; // no tooltip of its own: an outer Tooltip around the button says it instead (the accessible name stays the label)
  onClick: () => void;
  testId?: string; // a stable hook for the end-to-end tests
}

export function IconButton({ label, hint, icon, pressed, expanded, disabled = false, disabledReason, loading = false, compact = false, untitled = false, onClick, testId }: IconButtonProps): React.JSX.Element {
  const reason = disabled ? disabledReason : undefined;
  const words = reason ?? hint ?? ''; // a disabled button says why; otherwise the hint; with neither, the tooltip is its label alone (app tooltips R3, R7)
  const button = (
    <button
      type="button"
      className="ui-icon-button"
      aria-label={label}
      aria-description={words === '' ? undefined : words}
      aria-busy={loading ? true : undefined}
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
  if (untitled) return button;
  return (
    <Tooltip heading={label} text={words}>
      <span className="ui-icon-button__tip">{button}</span>
    </Tooltip>
  ); // the wrapper is the hover target, so a disabled button (which takes no pointer events) still shows it
}
