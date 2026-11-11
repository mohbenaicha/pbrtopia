import { isRawRecord } from '@shared/projects';

// The preview numbers that are remembered. The material-bound ones live in the record; the viewer prefs live in the app-wide settings.
// Reading is lenient: a missing, wrong or out-of-range value is clamped or replaced by its default, so these never block a load.

export const MESH_CHOICES = ['ball', 'plane', 'materialBall'] as const;
export type PreviewMesh = (typeof MESH_CHOICES)[number];

export const NORMAL_DIRECTIONS = ['opengl', 'directx'] as const;
export type NormalDirection = (typeof NORMAL_DIRECTIONS)[number]; // which way the green channel of the normal map points when it is drawn (preview R60)

/** Per project: exported in material.json and baked by imageops (preview R34-R36). */
export interface PreviewValues {
  tilingX: number; // 1..10, whole
  tilingY: number;
  heightScale: number; // 0..0.1 mesh units
  heightLevel: number; // 0..1, the grey that does not move
  heightContrast: number; // 0..3
}

/** App-wide viewer prefs (preview R33, R37, R39, R40). */
export interface PreviewPrefs {
  mesh: PreviewMesh;
  meshResolution: number; // 1..4 whole
  aoIntensity: number; // 0..2
  maskOverlayOpacity: number; // 0..1
  normalDirection: NormalDirection;
}

export const DEFAULT_PREVIEW_VALUES: PreviewValues = { tilingX: 1, tilingY: 1, heightScale: 0.02, heightLevel: 0.5, heightContrast: 1 };
export const DEFAULT_PREVIEW_PREFS: PreviewPrefs = { mesh: 'ball', meshResolution: 2, aoIntensity: 1, maskOverlayOpacity: 0.5, normalDirection: 'opengl' };

const clamped = (value: unknown, min: number, max: number, fallback: number): number => (typeof value === 'number' && Number.isFinite(value) ? Math.min(max, Math.max(min, value)) : fallback);
const clampedWhole = (value: unknown, min: number, max: number, fallback: number): number => Math.round(clamped(value, min, max, fallback));

export function readPreviewValues(raw: unknown): PreviewValues {
  const stored = isRawRecord(raw) ? raw : {};
  const defaults = DEFAULT_PREVIEW_VALUES;
  return {
    tilingX: clampedWhole(stored['tilingX'], 1, 10, defaults.tilingX),
    tilingY: clampedWhole(stored['tilingY'], 1, 10, defaults.tilingY),
    heightScale: clamped(stored['heightScale'], 0, 0.1, defaults.heightScale),
    heightLevel: clamped(stored['heightLevel'], 0, 1, defaults.heightLevel),
    heightContrast: clamped(stored['heightContrast'], 0, 3, defaults.heightContrast),
  };
}

export function readPreviewPrefs(raw: unknown): PreviewPrefs {
  const stored = isRawRecord(raw) ? raw : {};
  const defaults = DEFAULT_PREVIEW_PREFS;
  const mesh = MESH_CHOICES.find((choice) => choice === stored['mesh']) ?? defaults.mesh;
  return {
    mesh,
    meshResolution: clampedWhole(stored['meshResolution'], 1, 4, defaults.meshResolution),
    aoIntensity: clamped(stored['aoIntensity'], 0, 2, defaults.aoIntensity),
    maskOverlayOpacity: clamped(stored['maskOverlayOpacity'], 0, 1, defaults.maskOverlayOpacity),
    normalDirection: NORMAL_DIRECTIONS.find((choice) => choice === stored['normalDirection']) ?? defaults.normalDirection,
  };
}
