import type { Projection } from './cameraRig';

export interface MapAdjust {
  metalStrength: number;
  metalContrast: number;
  roughStrength: number;
  roughContrast: number;
}

// The viewport settings of data-model.md; stored globally by `projects/`, edited by the gear popover and Settings > Viewport.
export interface ViewportSettings {
  projection: Projection;
  hdri: string; // 'studio' is the built-in environment
  environmentIntensity: number; // 0-3
  environmentRotationDeg: number; // 0-360
  autoRotate: boolean;
  backgroundVisible: boolean;
  wireframe: boolean;
  mapAdjust: MapAdjust; // each 0-3
}

export const DEFAULT_VIEWPORT_SETTINGS: ViewportSettings = {
  projection: 'perspective',
  hdri: 'studio',
  environmentIntensity: 1,
  environmentRotationDeg: 0,
  autoRotate: false,
  backgroundVisible: false,
  wireframe: false,
  mapAdjust: { metalStrength: 1, metalContrast: 1, roughStrength: 1, roughContrast: 1 },
};

const clamp = (value: number, min: number, max: number): number => Math.min(max, Math.max(min, value));

export const clampMapAdjustValue = (value: number): number => clamp(value, 0, 3);

const numberOr = (value: unknown, fallback: number, min: number, max: number): number =>
  typeof value === 'number' && Number.isFinite(value) ? clamp(value, min, max) : fallback;
const booleanOr = (value: unknown, fallback: boolean): boolean => (typeof value === 'boolean' ? value : fallback);

// Settings read from storage or patched by a caller: values are clamped, wrong types fall back to the default, unknown fields are dropped.
export function clampViewportSettings(raw: unknown): ViewportSettings {
  const given = (typeof raw === 'object' && raw !== null ? raw : {}) as Record<string, unknown>;
  const adjust = (typeof given['mapAdjust'] === 'object' && given['mapAdjust'] !== null ? given['mapAdjust'] : {}) as Record<string, unknown>;
  const defaults = DEFAULT_VIEWPORT_SETTINGS;
  return {
    projection: given['projection'] === 'orthographic' ? 'orthographic' : 'perspective',
    hdri: typeof given['hdri'] === 'string' && given['hdri'] !== '' ? given['hdri'] : defaults.hdri,
    environmentIntensity: numberOr(given['environmentIntensity'], defaults.environmentIntensity, 0, 3),
    environmentRotationDeg: numberOr(given['environmentRotationDeg'], defaults.environmentRotationDeg, 0, 360),
    autoRotate: booleanOr(given['autoRotate'], defaults.autoRotate),
    backgroundVisible: booleanOr(given['backgroundVisible'], defaults.backgroundVisible),
    wireframe: booleanOr(given['wireframe'], defaults.wireframe),
    mapAdjust: {
      metalStrength: numberOr(adjust['metalStrength'], defaults.mapAdjust.metalStrength, 0, 3),
      metalContrast: numberOr(adjust['metalContrast'], defaults.mapAdjust.metalContrast, 0, 3),
      roughStrength: numberOr(adjust['roughStrength'], defaults.mapAdjust.roughStrength, 0, 3),
      roughContrast: numberOr(adjust['roughContrast'], defaults.mapAdjust.roughContrast, 0, 3),
    },
  };
}
