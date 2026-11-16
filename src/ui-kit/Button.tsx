import type { ReactNode } from 'react';
import { Spinner } from './Spinner';
import { Tooltip } from './Tooltip';
import './Button.css';

type ButtonVariant ='primary' | 'secondary' | 'ghost' | 'danger';

interface ButtonProps {
  variant?: ButtonVariant; // primary is the one orange action; the default is secondary
  size?: 'default' | 'large'; // large is for the one action an empty page is about
  loading?: boolean; // ignores clicks, shows a spinner, announced as busy; the button keeps focus
  disabled?: boolean; // not focusable, ignores input
  icon?: ReactNode;
  title?: string; // the tooltip's text under the label as its heading: what the button does, or why it is disabled (a styled Tooltip, not the native title)
  type?: 'button' | 'submit';
  pressed?: boolean; // for a choice among buttons: reported as aria-pressed and drawn selected
  onClick?: () => void;
  tutorial?: string; // the guided tour's anchor
  children: ReactNode;
}

export function Button({ variant = 'secondary', size = 'default', loading = false, disabled = false, icon, title, type = 'button', pressed, onClick, tutorial, children }: ButtonProps): React.JSX.Element {
  const heading = typeof children === 'string' ? children : (title ?? '');
  const words = title === undefined || title === heading ? '' : title; // a title that only repeats the label adds nothing under it (app tooltips R7)
  const button = (
    <button
      type={type}
      aria-description={disabled && words !== '' ? words : undefined} // a disabled button's tooltip is its reason: it is read out too
      aria-pressed={pressed}
      className="ui-button"
      data-tutorial={tutorial}
      data-variant={variant}
      data-size={size === 'large' ? 'large' : undefined}
      data-loading={loading ? '' : undefined}
      disabled={disabled}
      aria-busy={loading ? true : undefined}
      onClick={() => {
        if (!loading) onClick?.();
      }}
    >
      {loading ? <Spinner decorative /> : icon}
      <span>{children}</span>
    </button>
  );
  if (title === undefined) return button;
  return (
    <Tooltip heading={heading} text={words}>
      <span className="ui-button__tip">{button}</span>
    </Tooltip>
  ); // the wrapper is the hover target, so a disabled button still shows its reason
}
