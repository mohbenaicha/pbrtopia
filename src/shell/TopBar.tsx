import type { ReactNode } from 'react';
import { Icon, IconButton, Tooltip } from '../ui-kit';
import './TopBar.css';

interface TopBarProps {
  projectName: string | null; // the open project's name; null until its record is loaded
  fallbackTitle: string; // shown on the left while there is no name
  onOpenProjects: () => void;
  onOpenSettings: () => void;
  settingsDisabledReason: string | null; // settings R1: why Settings cannot be opened now
  exportLabel?: string; // the export icon's name and tooltip; "Export project" unless an app exports something else
  onExportProject: () => void;
  exporting: boolean;
  exportDisabledReason: string | null; // projects R13: why Export cannot run now
  extraActions?: ReactNode; // an app's own icon buttons, between Export project and Settings
}

// The open project's name on the left, the icon actions (Projects, Export project, the app's own, Settings) in the middle (viewport-layout R4; settings R1; projects R13).
export function TopBar({ projectName, fallbackTitle, onOpenProjects, onOpenSettings, settingsDisabledReason, exportLabel = 'Export project', onExportProject, exporting, exportDisabledReason, extraActions }: TopBarProps): React.JSX.Element {
  const name = projectName ?? fallbackTitle;
  return (
    <header className="top-bar" data-testid="top-bar">
      <Tooltip heading={name} text={projectName === undefined ? 'The app you are using.' : 'The project you have open.'}>
        <div className="top-bar__name" data-region="name">
          {name}
        </div>
      </Tooltip>
      <div className="top-bar__actions" data-region="actions" data-tutorial="topbar-actions">
        <IconButton label="Projects" icon={<Icon name="projects-list" />} onClick={onOpenProjects} />
        <IconButton label={exportLabel} icon={<Icon name="download" />} loading={exporting} disabled={exportDisabledReason !== null} {...(exportDisabledReason === null ? {} : { disabledReason: exportDisabledReason })} onClick={onExportProject} />
        {extraActions}
        <IconButton label="Settings" icon={<Icon name="gear" />} disabled={settingsDisabledReason !== null} {...(settingsDisabledReason === null ? {} : { disabledReason: settingsDisabledReason })} onClick={onOpenSettings} />
      </div>
    </header>
  );
}
