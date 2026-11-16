import type { LiftRect } from './highlightBounds';

/** Clone R20: bytes a lifted texel costs: colour 4, surface 4, normal 4, fade 1 and the blur's intermediate 1. */
export const LAYER_BYTES_PER_TEXEL = 14;
/** Clone R20: the most memory one lifted copy may take. */
export const LAYER_BUDGET_BYTES = 96 * 1024 * 1024;
/** Clone R10: the fade band never reaches further than this many texels, so its blur stays cheap and unbanded. */
export const FADE_RADIUS_CAP = 64;

/**
 * Clone R10: the radius, in texels, of the fade band at the edge of the copy: a quarter of the brush size at Hardness 0, none at Hardness 1. `size` is the brush
 * size as a fraction of the picture.
 */
export function fadeRadiusTexels(hardness: number, size: number, side: number): number {
  return Math.min(FADE_RADIUS_CAP, Math.round((1 - hardness) * size * side / 4));
}

export type Liftability = 'ok' | 'empty' | 'too-large';

/**
 * Clone R6: whether a highlight's lift rectangle (null when there is no highlight) can become a copy: its diagonal must not exceed the picture side (so a copy
 * at scale 1 lands within one picture width, R9a) and its layer must fit the budget (R20).
 */
export function liftability(rect: LiftRect | null, side: number): Liftability {
  if (rect === null) return 'empty';
  if (Math.hypot(rect.w, rect.h) > side) return 'too-large';
  return rect.w * rect.h * LAYER_BYTES_PER_TEXEL > LAYER_BUDGET_BYTES ? 'too-large' : 'ok';
}
