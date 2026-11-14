/** Compositing R9: the brush controls, their ranges and defaults. Pure data; nothing here knows the pointer, the GPU or the DOM (R70). */
export interface BrushParams {
  size: number; // footprint as a fraction of the picture side
  strength: number;
  hardness: number;
  distance: number; // times the footprint
  rotation: number; // degrees
  randomRotation: boolean;
  height: { on: boolean; level: number; additive: boolean };
  edgeBurn: { on: boolean; direction: 'raise' | 'dent' };
}

export const DEFAULT_BRUSH: BrushParams = {
  size: 0.12,
  strength: 1,
  hardness: 0.7,
  distance: 1,
  rotation: 0,
  randomRotation: false,
  height: { on: false, level: 0.3, additive: false },
  edgeBurn: { on: false, direction: 'raise' },
};

const RANGES = {
  size: [0.02, 0.5],
  strength: [0, 1],
  hardness: [0, 1],
  distance: [0.05, 2],
  level: [-1, 1],
} as const satisfies Record<string, readonly [number, number]>;

const clampTo = (value: number, [low, high]: readonly [number, number], fallback: number): number => (Number.isFinite(value) ? Math.min(Math.max(value, low), high) : fallback);

/** Compositing R12: an angle in degrees brought into (-180, 180]; 180 stays 180. */
export function wrapDegrees(degrees: number): number {
  if (!Number.isFinite(degrees)) return 0;
  const turned = ((degrees % 360) + 360) % 360;
  return turned > 180 ? turned - 360 : turned;
}

/** Compositing R12: one wheel notch turns 5 degrees, a fine notch (Ctrl + Shift) 1 degree; a positive notch turns the angle up. */
export function stepRotation(degrees: number, notches: number, fine: boolean): number {
  return wrapDegrees(degrees + notches * (fine ? 1 : 5));
}

/** Compositing R9: every value in its range (a NaN falls back to the default); the angle wraps instead of clamping. */
export function clampBrush(params: BrushParams): BrushParams {
  return {
    size: clampTo(params.size, RANGES.size, DEFAULT_BRUSH.size),
    strength: clampTo(params.strength, RANGES.strength, DEFAULT_BRUSH.strength),
    hardness: clampTo(params.hardness, RANGES.hardness, DEFAULT_BRUSH.hardness),
    distance: clampTo(params.distance, RANGES.distance, DEFAULT_BRUSH.distance),
    rotation: wrapDegrees(params.rotation),
    randomRotation: params.randomRotation,
    height: { on: params.height.on, level: clampTo(params.height.level, RANGES.level, DEFAULT_BRUSH.height.level), additive: params.height.additive },
    edgeBurn: { on: params.edgeBurn.on, direction: params.edgeBurn.direction === 'dent' ? 'dent' : 'raise' },
  };
}
