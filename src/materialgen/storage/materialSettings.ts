import { isRawRecord, readAppSettings, type AppSettingsRecord, type RawRecord } from '@shared/projects';
import { readPreviewPrefs, type PreviewPrefs } from './previewValues';

// The shared app-wide settings plus the material app's own fields (app R27). `previewPrefs` is not part of the shared `viewport` object; `savedSetups` is the
// generation wave's list of named plans, typed there (generation R20) and kept here as plain records.
export interface MaterialSettingsRecord extends AppSettingsRecord {
  previewPrefs: PreviewPrefs;
  savedSetups: RawRecord[];
}

/** Reads stored settings leniently: every part that is missing or wrong falls back to its default, and a saved setup that is not a record is left out. */
export function readMaterialSettings(raw: unknown): MaterialSettingsRecord {
  const stored = isRawRecord(raw) ? raw : undefined;
  const setups = stored?.['savedSetups'];
  return {
    ...readAppSettings(raw),
    previewPrefs: readPreviewPrefs(stored?.['previewPrefs']),
    savedSetups: Array.isArray(setups) ? setups.filter(isRawRecord) : [],
  };
}
