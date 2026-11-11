import { useId, type ReactNode } from 'react';

interface SettingsGroupProps {
  title: string;
  hint?: string; // a line under the heading
  children?: ReactNode; // the rows; a group that is only a hint and an action has none
  messages?: ReactNode; // saved, refused or problem text that belongs to this group, shown under its rows
  actions?: ReactNode; // buttons that act on the whole group, in the last row, right-aligned
}

const isDrawn = (node: ReactNode): boolean => node !== undefined && node !== null && node !== false;

// Settings R12: a filled card with a small heading, an optional hint, its rows, then its messages and its actions.
export function SettingsGroup({ title, hint, children, messages, actions }: SettingsGroupProps): React.JSX.Element {
  const headingId = useId();
  return (
    <div className="settings-card" role="group" aria-labelledby={headingId}>
      <h3 className="settings-card__heading" id={headingId}>
        {title}
      </h3>
      {hint !== undefined && <p className="settings-card__hint">{hint}</p>}
      {isDrawn(children) && <div className="settings-card__rows">{children}</div>}
      {isDrawn(messages) && (
        <div className="settings-card__messages" data-messages="">
          {messages}
        </div>
      )}
      {isDrawn(actions) && (
        <div className="settings-card__actions" data-actions="">
          {actions}
        </div>
      )}
    </div>
  );
}
