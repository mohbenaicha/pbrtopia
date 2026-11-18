import { useId, type ReactNode } from 'react';
import { Tooltip } from '../../ui-kit';
import './SettingsSections.css';

interface SettingsPageProps {
  title: string;
  description?: string; // one plain line under the title; a section with nothing to add has none (settings R20)
  tutorial?: string; // the guided tour's anchor on the page itself (tutorial R22)
  children: ReactNode; // the groups, stacked
}

// Settings R12: the same page for every section: the large title, one line of description, then the section's groups 24 px apart.
export function SettingsPage({ title, description, tutorial, children }: SettingsPageProps): React.JSX.Element {
  const titleId = useId();
  return (
    <section className="settings-page" aria-labelledby={titleId} data-tutorial={tutorial}>
      <header className="settings-page__header">
        <Tooltip heading={title} text={description ?? ''}>
          <h2 className="settings-page__title" id={titleId}>
            {title}
          </h2>
        </Tooltip>
        {description !== undefined && <p className="settings-page__description">{description}</p>}
      </header>
      {children}
    </section>
  );
}
