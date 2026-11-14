/** Compositing R9, R50: the brush controls, their ranges and defaults. Pure data; nothing here knows the pointer, the GPU or the DOM (R70). */

/** One randomisable control: the single value, whether the dice is on, and the range each stamp draws from while it is (the two ends of the control by default). */
export interface BrushValue {
  value: number;
  random: boolean;
  low: number;
  high: number;
}

export type BrushControlKey = 'size' | 'strength' | 'hardness' | 'distance' | 'rotation';

export interface BrushParams {
  size: BrushValue; // footprint as a fraction of the picture side
  strength: BrushValue;
  hardness: BrushValue;
  distance: BrushValue; // times the footprint
  rotation: BrushValue; // degrees
  height: { on: boolean; level: number; additive: boolean };
  edgeBurn: { on: boolean; direction: 'raise' | 'dent' };
}

/** What a control may hold: its range, its slider step and its default value. The single place these numbers live (R9). */
export interface ControlLimits {
  min: number;
  max: number;
  step: number;
  initial: number;
}

export const BRUSH_CONTROLS: Readonly<Record<BrushControlKey, ControlLimits>> = {
  size: { min: 0.02, max: 1, step: 0.005, initial: 0.12 },
  strength: { min: 0, max: 1, step: 0.01, initial: 1 },
  hardness: { min: 0, max: 1, step: 0.01, initial: 0.7 },
  distance: { min: 0.05, max: 2, step: 0.05, initial: 1 },
  rotation: { min: -180, max: 180, step: 1, initial: 0 },
};

const CONTROL_KEYS = Object.keys(BRUSH_CONTROLS) as readonly BrushControlKey[];
const HEIGHT_LEVEL = { min: -1, max: 1 } as const;

const initialValueOf = ({ min, max, initial }: ControlLimits): BrushValue => ({ value: initial, random: false, low: min, high: max });

export const DEFAULT_BRUSH: BrushParams = {
  size: initialValueOf(BRUSH_CONTROLS.size),
  strength: initialValueOf(BRUSH_CONTROLS.strength),
  hardness: initialValueOf(BRUSH_CONTROLS.hardness),
  distance: initialValueOf(BRUSH_CONTROLS.distance),
  rotation: initialValueOf(BRUSH_CONTROLS.rotation),
  height: { on: false, level: 0.3, additive: false },
  edgeBurn: { on: false, direction: 'raise' },
};

const clampTo = (value: number, min: number, max: number, fallback: number): number => (Number.isFinite(value) ? Math.min(Math.max(value, min), max) : fallback);

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

/** Compositing R50: the brush with one control's value, dice or range changed; the others are the same objects. */
export function updateBrushValue(params: BrushParams, key: BrushControlKey, patch: Partial<BrushValue>): BrushParams {
  return { ...params, [key]: { ...params[key], ...patch } };
}

/**
 * Compositing R52: what one stamp uses for a control. The dice off: the single value. The dice on: `draw` (0 up to but not including 1) mapped onto the range
 * and clamped to the control, so the top end is reached only by the clamp, and equal ends give exactly that value.
 */
export function drawBrushValue(control: BrushValue, limits: ControlLimits, draw: number): number {
  const picked = control.random ? control.low + draw * (control.high - control.low) : control.value;
  return Math.min(Math.max(picked, limits.min), limits.max);
}

function clampValue(control: BrushValue, limits: ControlLimits, key: BrushControlKey): BrushValue {
  const { min, max } = limits;
  const fallback = DEFAULT_BRUSH[key];
  const value = key === 'rotation' ? clampTo(wrapDegrees(control.value), min, max, fallback.value) : clampTo(control.value, min, max, fallback.value);
  const first = clampTo(control.low, min, max, fallback.low);
  const second = clampTo(control.high, min, max, fallback.high);
  return { value, random: control.random === true, low: Math.min(first, second), high: Math.max(first, second) };
}

/** Compositing R9, R50: every value and both ends of each range inside the control (a NaN falls back to the default, low is never above high); the angle wraps instead of clamping. */
export function clampBrush(params: BrushParams): BrushParams {
  const clamped = { ...params };
  for (const key of CONTROL_KEYS) clamped[key] = clampValue(params[key], BRUSH_CONTROLS[key], key);
  return {
    ...clamped,
    height: { on: params.height.on, level: clampTo(params.height.level, HEIGHT_LEVEL.min, HEIGHT_LEVEL.max, DEFAULT_BRUSH.height.level), additive: params.height.additive },
    edgeBurn: { on: params.edgeBurn.on, direction: params.edgeBurn.direction === 'dent' ? 'dent' : 'raise' },
  };
}
