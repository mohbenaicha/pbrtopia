// normal-reauthor R4, I3: every field inside its range and on its step; anything that is not a finite number takes the default.
import {
  DEFAULT_PARAMS,
  SEAM_FLATTEN_MAX,
  SEAM_RADIUS_MAX,
  SEAM_RADIUS_STEP,
  SHARPNESS_MAX,
  SHARPNESS_STEP,
  SLOPE_DEG_MAX,
  SLOPE_DEG_MIN,
  type ReauthorParams,
} from './reauthorParams';

function clampField(raw: unknown, min: number, max: number, step: number, fallback: number): number {
  if (typeof raw !== 'number' || !Number.isFinite(raw)) return fallback;
  const snapped = Math.round(raw / step) * step;
  return Math.min(max, Math.max(min, snapped));
}

const roundToDecimals = (value: number): number => Math.round(value * 100) / 100;

export function clampReauthorParams(raw: Partial<Record<keyof ReauthorParams, unknown>>): ReauthorParams {
  return {
    slopeDeg: clampField(raw.slopeDeg, SLOPE_DEG_MIN, SLOPE_DEG_MAX, 1, DEFAULT_PARAMS.slopeDeg),
    seamRadius: clampField(raw.seamRadius, 0, SEAM_RADIUS_MAX, SEAM_RADIUS_STEP, DEFAULT_PARAMS.seamRadius),
    seamFlatten: clampField(raw.seamFlatten, 0, SEAM_FLATTEN_MAX, 1, DEFAULT_PARAMS.seamFlatten),
    sharpness: roundToDecimals(clampField(raw.sharpness, 0, SHARPNESS_MAX, SHARPNESS_STEP, DEFAULT_PARAMS.sharpness)), // R9: 0.15, not 0.15000000000000002
  };
}
