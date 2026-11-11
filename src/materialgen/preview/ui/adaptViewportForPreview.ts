import type { Viewport, ViewportSettings } from '@shared/viewport';

/** Preview R29, R30: what the preview never shows, whatever a record saved by the projection app says: a perspective camera, no grid, no wireframe, no faceting, no smoothing. */
const ALWAYS: Partial<ViewportSettings> = { projection: 'perspective', grid: false, wireframe: false, flatShading: false, smoothAngleDeg: 180 };

type SettingsTarget = Pick<Viewport, 'setSettings' | 'on'>;

/** The viewport as the settings hook should see it: every settings write also carries the values the preview keeps fixed. */
export function adaptViewportForPreview(viewport: SettingsTarget): SettingsTarget {
  return {
    setSettings: (patch) => viewport.setSettings({ ...patch, ...ALWAYS }),
    on: viewport.on,
  };
}
