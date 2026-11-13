import type { ReactNode } from 'react';
import type { SharedProjectStore } from '../../projects/SharedProjectStore';
import { Button } from '../../ui-kit';
import { DEFAULT_VIEWPORT_SETTINGS, type ViewportSettings } from '../../viewport';
import { useViewportSettings } from '../useViewportSettings';
import { SettingsGroup } from './SettingsGroup';
import { SettingsPage } from './SettingsPage';

export interface ViewportControlProps {
  settings: ViewportSettings;
  onChange: (patch: Partial<ViewportSettings>) => void;
}

interface ViewportSectionProps {
  store: Pick<SharedProjectStore, 'loadAppSettings' | 'saveAppSettings'>;
  /** The cards of controls the app offers, drawn once the saved settings are read (settings R8; the gear popover's controls). */
  renderControls: (controls: ViewportControlProps) => ReactNode;
  saveDelayMs?: number; // quiet time before a change is written (the gear popover's rule); tests shorten it
  onResetExtra?: () => void; // other app-wide values the app keeps beside the viewport settings, put back by the same Reset to defaults
}

// Settings R8: the gear popover's controls on the saved app-wide viewport settings, as cards, with Reset to defaults. No viewport is live here;
// the settings apply when a project is next shown.
export function ViewportSection({ store, renderControls, saveDelayMs, onResetExtra }: ViewportSectionProps): React.JSX.Element {
  const { settings, loaded, change } = useViewportSettings(store, null, saveDelayMs === undefined ? {} : { saveDelayMs });
  return (
    <SettingsPage title="Viewport" description="These are the defaults every project starts with. They apply when you next open a project.">
      {loaded && renderControls({ settings, onChange: change })}
      <SettingsGroup
        title="Defaults"
        actions={
          <Button
            disabled={!loaded}
            onClick={() => {
              change(DEFAULT_VIEWPORT_SETTINGS);
              onResetExtra?.();
            }}
          >
            Reset to defaults
          </Button>
        }
      />
    </SettingsPage>
  );
}
