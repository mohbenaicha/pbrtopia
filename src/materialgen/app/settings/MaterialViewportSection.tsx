import { ViewportSection } from '@shared/shell';
import { usePreviewPrefs } from '@mat/preview';
import type { MaterialProjectStore } from '@mat/storage';
import { MaterialViewportControls } from './MaterialViewportControls';

export type MaterialSettingsStore = Pick<MaterialProjectStore, 'loadAppSettings' | 'saveAppSettings'>;

/** Materialgen app R43: Settings > Viewport. The shared section for the viewport settings, with the app-wide preview prefs beside them and put back by the same Reset to defaults. */
export function MaterialViewportSection({ store }: { store: MaterialSettingsStore }): React.JSX.Element {
  const { prefs, loaded, change, reset } = usePreviewPrefs(store);
  return (
    <ViewportSection
      store={store}
      renderControls={(controls) => (loaded ? <MaterialViewportControls {...controls} prefs={prefs} onPrefsChange={change} /> : null)}
      onResetExtra={reset}
    />
  );
}
