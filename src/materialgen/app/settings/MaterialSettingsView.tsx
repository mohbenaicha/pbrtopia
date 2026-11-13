import { ApiKeysSection, ModelsSection, SettingsView, StorageSection, type SettingsSectionDef, type SettingsStore } from '@shared/shell';
import type { ProjectImportState } from '@shared/projects';
import { SETTINGS_SECTIONS, settingsHash, type SettingsSection } from '../routes/router';
import { MaterialShortcutsSection } from './MaterialShortcutsSection';
import { MaterialViewportSection, type MaterialSettingsStore } from './MaterialViewportSection';

export const SECTION_LABELS: Record<SettingsSection, string> = {
  keys: 'API keys',
  models: 'Models',
  viewport: 'Viewport',
  shortcuts: 'Shortcuts',
  storage: 'Storage',
};

export const DELETE_ALL_TEXT = 'Every project, with its maps and thumbnail, is removed from this browser. Settings and the saved API keys stay. This cannot be undone.';
export const DESKTOP_DELETE_ALL_TEXT = 'Every project, with its maps and thumbnail, is removed from the library folder. Settings and the saved API keys stay. This cannot be undone.';

const SECTIONS: SettingsSectionDef<SettingsSection>[] = SETTINGS_SECTIONS.map((id) => ({
  id,
  label: SECTION_LABELS[id],
  render: (context) => {
    switch (id) {
      case 'keys':
        return <ApiKeysSection rejectedKeys={context.keyCheck.flags} onKeySaved={context.keyCheck.keySaved} />;
      case 'models':
        return <ModelsSection store={context.store} vault={context.backends.keys} keysLoaded={context.backends.keysLoaded} refresh={context.refresh} />;
      case 'viewport':
        return <MaterialViewportSection store={context.store as unknown as MaterialSettingsStore} />; // the shell types the store as the shared one; this app always hands it its own, which also keeps previewPrefs
      case 'shortcuts':
        return <MaterialShortcutsSection />;
      case 'storage':
        return <StorageSection store={context.store} projectImport={context.projectImport} deleteAllText={context.backends.location === undefined ? DELETE_ALL_TEXT : DESKTOP_DELETE_ALL_TEXT} {...(context.backends.location === undefined ? {} : { location: context.backends.location })} />;
    }
  },
}));

interface MaterialSettingsViewProps {
  store: SettingsStore;
  section: SettingsSection;
  projectImport: ProjectImportState;
}

/** Materialgen app R40: the shell's settings view over this app's five sections. */
export function MaterialSettingsView({ store, section, projectImport }: MaterialSettingsViewProps): React.JSX.Element {
  return <SettingsView store={store} sections={SECTIONS} section={section} settingsHash={settingsHash} projectImport={projectImport} />;
}
