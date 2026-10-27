import type { IUniform } from 'three';
import { clampMapAdjustValue, DEFAULT_VIEWPORT_SETTINGS, MAP_ADJUST_KEYS, type MapAdjust } from './viewportSettings';

export type MapAdjustUniforms = { [Key in keyof MapAdjust]: IUniform<number> };

// One shared uniform per slider: every rough, metal or normal look reads these, so moving a slider rebuilds no material.
export function createMapAdjustUniforms(initial: MapAdjust = DEFAULT_VIEWPORT_SETTINGS.mapAdjust): MapAdjustUniforms {
  return Object.fromEntries(MAP_ADJUST_KEYS.map((key) => [key, { value: initial[key] }])) as MapAdjustUniforms;
}

// Writes the named values in place (clamped to 0-3) so materials that hold the uniforms see them.
export function setMapAdjust(uniforms: MapAdjustUniforms, patch: Partial<MapAdjust>): void {
  for (const key of Object.keys(patch) as (keyof MapAdjust)[]) {
    const value = patch[key];
    if (value !== undefined) uniforms[key].value = clampMapAdjustValue(value);
  }
}
