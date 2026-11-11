import { useId, type ReactNode } from 'react';

/** A bold subheading with the controls under it, so the controls inside can leave its word out of their labels. */
export function SettingsSubsection({ title, children }: { title: string; children: ReactNode }): React.JSX.Element {
  const id = useId();
  return (
    <div className="viewport-settings__subsection" role="group" aria-labelledby={id}>
      <h4 className="viewport-settings__subheading" id={id}>{title}</h4>
      {children}
    </div>
  );
}

export function SettingsSection({ title, children }: { title: string; children: ReactNode }): React.JSX.Element {
  return (
    <section className="viewport-settings__section">
      <h3 className="viewport-settings__heading">{title}</h3>
      {children}
    </section>
  );
}
