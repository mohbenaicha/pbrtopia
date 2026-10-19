import type { ReactNode } from 'react';
import { Spinner } from './Spinner';
import './Button.css';

export type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger';

export interface ButtonProps {
  variant?: ButtonVariant; // primary is the one orange action; the default is secondary
  loading?: boolean; // ignores clicks, shows a spinner, announced as busy; the button keeps focus
  disabled?: boolean; // not focusable, ignores input
  icon?: ReactNode;
  type?: 'button' | 'submit';
  onClick?: () => void;
  children: ReactNode;
}

export function Button({ variant = 'secondary', loading = false, disabled = false, icon, type = 'button', onClick, children }: ButtonProps): React.JSX.Element {
  return (
    <button
      type={type}
      className="ui-button"
      data-variant={variant}
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
}
