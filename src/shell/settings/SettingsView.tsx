import type { ReactNode } from 'react';
import type { SharedProjectStore } from '../../projects/SharedProjectStore';
import type { ProjectImportState } from '../../projects/ui/ImportProjectButton';
import { Button } from '../../ui-kit';
import type { ResolvedBackends } from '../backends/appBackends';
import { useAppBackends } from '../backends/AppBackendsProvider';
import { findSettingsBackHash } from './findSettingsBackHash';
import { useKeyCheck, type KeyCheckState } from './useKeyCheck';
import { useModelListRefresh, type ModelListRefreshState } from './useModelListRefresh';
import './SettingsView.css';

export type SettingsStore = Pick<SharedProjectStore, 'loadAppSettings' | 'saveAppSettings' | 'loadProject' | 'estimateStorage' | 'requestPersistence' | 'listProjects' | 'deleteProjects'>;

/** What a section draws from: the store, the app's single import, and the state held here so it outlives a change of section. */
export interface SectionContext {
  store: SettingsStore;
  projectImport: ProjectImportState;
  keyCheck: KeyCheckState;
  refresh: ModelListRefreshState;
  backends: ResolvedBackends;
}

export interface SettingsSectionDef<Section extends string> {
  id: Section;
  label: string;
  render: (context: SectionContext) => ReactNode;
}

interface SettingsViewProps<Section extends string> {
  store: SettingsStore;
  sections: readonly SettingsSectionDef<Section>[]; // the left navigation, in order
  section: Section;
  settingsHash: (section: Section) => string;
  projectImport: ProjectImportState; // the app's single import, shared with the project list (settings R11)
}

// Settings R2: the left navigation, Back, and the section the address names.
export function SettingsView<Section extends string>({ store, sections, section, settingsHash, projectImport }: SettingsViewProps<Section>): React.JSX.Element {
  const backends = useAppBackends();
  const keyCheck = useKeyCheck(backends.keys, backends.discoverModels); // held here so a flag outlives a change of section
  const refresh = useModelListRefresh(store, backends.keys, backends.discoverModels); // likewise a running Refresh
  const goBack = async (): Promise<void> => {
    window.location.hash = await findSettingsBackHash(store);
  };
  const current = sections.find((candidate) => candidate.id === section);
  return (
    <main className="settings-view" data-testid="settings-view" data-section={section}>
      <nav className="settings-view__nav" aria-label="Settings sections">
        <div className="settings-view__back">
          <Button onClick={() => void goBack()}>Back</Button>
        </div>
        <h1 className="settings-view__title">Settings</h1>
        <ul className="settings-view__links">
          {sections.map((entry) => (
            <li key={entry.id}>
              <a href={settingsHash(entry.id)} aria-current={entry.id === section ? 'page' : undefined}>
                {entry.label}
              </a>
            </li>
          ))}
        </ul>
      </nav>
      <div className="settings-view__scroll">
        <div className="settings-view__content" data-tutorial={`settings-${section}`}>{current === undefined ? <h2 className="settings-page__title">{section}</h2> : current.render({ store, projectImport, keyCheck, refresh, backends })}</div>
      </div>
    </main>
  );
}
