import { useId, type ReactNode } from 'react';
import { Tooltip } from '../../ui-kit';

interface SettingsHeadingProps {
  title: string;
  hint?: string; // what the group of controls below it is for (app tooltips R1)
  children: ReactNode;
}

/** A bold subheading with the controls under it, so the controls inside can leave its word out of their labels. */
export function SettingsSubsection({ title, hint, children }: SettingsHeadingProps): React.JSX.Element {
  const id = useId();
  return (
    <div className="viewport-settings__subsection" role="group" aria-labelledby={id}>
      <Tooltip heading={title} text={hint ?? ''}><h4 className="viewport-settings__subheading" id={id}>{title}</h4></Tooltip>
      <div className="viewport-settings__rows">{children}</div>
    </div>
  );
}

export function SettingsSection({ title, hint, children }: SettingsHeadingProps): React.JSX.Element {
  return (
    <section className="viewport-settings__section">
      <Tooltip heading={title} text={hint ?? ''}><h3 className="viewport-settings__heading">{title}</h3></Tooltip>
      {children}
    </section>
  );
}
