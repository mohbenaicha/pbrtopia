import { isRawRecord, readAppSettings, type AppSettingsRecord } from '@shared/projects';
import { readPreviewPrefs, type PreviewPrefs } from './previewValues';

// The shared app-wide settings plus the material app's own field (app R27). `previewPrefs` is not part of the shared `viewport` object.
export interface MaterialSettingsRecord extends AppSettingsRecord {
  previewPrefs: PreviewPrefs;
}

/** Reads stored settings leniently: every part that is missing or wrong falls back to its default. */
export function readMaterialSettings(raw: unknown): MaterialSettingsRecord {
  return { ...readAppSettings(raw), previewPrefs: readPreviewPrefs(isRawRecord(raw) ? raw['previewPrefs'] : undefined) };
}
