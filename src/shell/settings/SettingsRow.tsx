import type { ReactNode } from 'react';
import { Tooltip } from '../../ui-kit';

interface SettingsRowProps {
  label: string;
  hint?: string;
  children: ReactNode; // the control
}

// Settings R12: label (and its hint) on the left, its control on the right; the two columns stack when the content area is narrow.
export function SettingsRow({ label, hint, children }: SettingsRowProps): React.JSX.Element {
  return (
    <div className="settings-field">
      <div className="settings-field__label" data-label="">
        <Tooltip heading={label} text={hint ?? ''}><span>{label}</span></Tooltip>
        {hint !== undefined && (
          <span className="settings-field__hint" data-hint="">
            {hint}
          </span>
        )}
      </div>
      <div className="settings-field__control" data-control="">
        {children}
      </div>
    </div>
  );
}
