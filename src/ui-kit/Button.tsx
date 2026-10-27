import type { ReactNode } from 'react';
import { Spinner } from './Spinner';
import './Button.css';

type ButtonVariant ='primary' | 'secondary' | 'ghost' | 'danger';

interface ButtonProps {
  variant?: ButtonVariant; // primary is the one orange action; the default is secondary
  size?: 'default' | 'large'; // large is for the one action an empty page is about
  loading?: boolean; // ignores clicks, shows a spinner, announced as busy; the button keeps focus
  disabled?: boolean; // not focusable, ignores input
  icon?: ReactNode;
  title?: string; // a tooltip, for a button whose label can be hidden when space runs out
  type?: 'button' | 'submit';
  onClick?: () => void;
  children: ReactNode;
}

export function Button({ variant = 'secondary', size = 'default', loading = false, disabled = false, icon, title, type = 'button', onClick, children }: ButtonProps): React.JSX.Element {
  return (
    <button
      type={type}
      title={title}
      className="ui-button"
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
}
