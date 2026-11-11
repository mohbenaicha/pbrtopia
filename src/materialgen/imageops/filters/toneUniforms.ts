import { controlsFor, type EditMapKind, type EditValues } from './editControls';
import type { LumaRange } from './lumaRange';

// Imageops R14, R15, R20: the control values as the tone shader's uniforms. A control the map kind does not show contributes its default.

export type Vec2 = [number, number];
export type Vec3 = [number, number, number];
export type Vec4 = [number, number, number, number];

export interface ToneUniforms {
  albedo: boolean;
  grey: boolean;
  normalizeRange: Vec2; // [0, 0] when Normalise is off or the map is flat
  levels: Vec3;
  exposure: Vec4; // exposure, brightness, contrast, gamma
  tone: Vec4; // highlights, shadows, whites, blacks
  shape: Vec4; // histogram remap, height intensity, bias, invert
  colorA: Vec4; // saturation, hue, chroma, vibrance
  colorB: Vec2; // temperature, tint
}

export function buildToneUniforms(kind: EditMapKind, values: EditValues, range: LumaRange): ToneUniforms {
  const shown = new Map(controlsFor(kind).map((control) => [control.id, control.defaultValue]));
  const v = (id: string, fallback: number): number => (shown.has(id) ? (values[id] ?? shown.get(id)!) : fallback);
  const normalizing = v('normalize', 0) > 0.5 && range.max > range.min;
  return {
    albedo: kind === 'albedo',
    grey: kind !== 'albedo' && kind !== 'normal',
    normalizeRange: normalizing ? [range.min, range.max] : [0, 0],
    levels: [v('levelsMin', 0), v('levelsMid', 1), v('levelsMax', 1)],
    exposure: [v('exposure', 0), v('brightness', 0), v('contrast', 1), v('gamma', 1)],
    tone: [v('highlights', 0), v('shadows', 0), v('whites', 0), v('blacks', 0)],
    shape: [v('histogramRemap', 1), v('heightIntensity', 1), v('roughnessBias', 0) + v('metallicBias', 0), v('invert', 0) > 0.5 ? 1 : 0],
    colorA: [v('saturation', 1), v('hue', 0), v('chroma', 1), v('vibrance', 0)],
    colorB: [v('temperature', 0), v('tint', 0)],
  };
}
