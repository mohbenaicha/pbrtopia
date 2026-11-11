import type { SharedProjectStore } from '../projects/SharedProjectStore';
import type { StoreResult } from '../projects/storeError';
import { clampViewportSettings, type ViewportSettings } from '../viewport';

type SettingsStore = Pick<SharedProjectStore, 'loadAppSettings' | 'saveAppSettings'>;

/** The saved viewport settings, clamped to their ranges; the defaults where nothing is saved. */
export async function loadViewportSettings(store: SettingsStore): Promise<ViewportSettings> {
  return clampViewportSettings((await store.loadAppSettings()).viewport);
}

/** Saves the viewport settings as the app-wide ones, leaving the other app settings as they are. */
export function saveViewportSettings(store: SettingsStore, settings: ViewportSettings): Promise<StoreResult<void>> {
  return store.saveAppSettings({ viewport: { ...settings } });
}
