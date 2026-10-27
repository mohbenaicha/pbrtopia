import { describe, expect, it } from 'vitest';
import { DEFAULT_VIEWPORT_SETTINGS, clampViewportSettings } from '../../src/viewport/viewportSettings';

describe('viewport settings', () => {
  it('R14 defaults match the data model', () => {
    expect(DEFAULT_VIEWPORT_SETTINGS).toEqual({
      projection: 'perspective',
      hdri: 'studio',
      environmentIntensity: 1,
      environmentRotationDeg: 0,
      autoRotate: false,
      backgroundVisible: false,
      wireframe: false,
      flatShading: false,
      smoothAngleDeg: 180,
      grid: true,
      mapAdjust: { metalStrength: 1, metalContrast: 1, roughStrength: 1, roughContrast: 1, normalStrength: 1, normalContrast: 1 },
    });
  });

  it('viewport-layout R24 the grid setting is shown by default, must be a boolean, and falls back to shown for anything else', () => {
    expect(clampViewportSettings({ grid: false }).grid).toBe(false);
    expect(clampViewportSettings({ grid: 'no' }).grid).toBe(true);
    expect(clampViewportSettings({}).grid).toBe(true);
  });

  it('R14 flat shading must be a boolean and the smooth angle is clamped to 0-180, with the defaults for anything else', () => {
    expect(clampViewportSettings({ flatShading: true, smoothAngleDeg: 45 })).toMatchObject({ flatShading: true, smoothAngleDeg: 45 });
    expect(clampViewportSettings({ smoothAngleDeg: 400 }).smoothAngleDeg).toBe(180);
    expect(clampViewportSettings({ smoothAngleDeg: -5 }).smoothAngleDeg).toBe(0);
    expect(clampViewportSettings({ flatShading: 'yes', smoothAngleDeg: 'x' })).toMatchObject({ flatShading: false, smoothAngleDeg: 180 });
  });

  it('R14 stored values are clamped and unknown or wrongly typed fields fall back to the default', () => {
    const result = clampViewportSettings({
      projection: 'sideways',
      environmentIntensity: 8,
      environmentRotationDeg: 400,
      autoRotate: 'yes',
      wireframe: true,
      mapAdjust: { metalStrength: -1, roughContrast: 2, extra: 1 },
      unknown: 5,
    });
    expect(result.projection).toBe('perspective');
    expect(result.environmentIntensity).toBe(3);
    expect(result.environmentRotationDeg).toBe(360);
    expect(result.autoRotate).toBe(false);
    expect(result.wireframe).toBe(true);
    expect(result.mapAdjust).toEqual({ metalStrength: 0, metalContrast: 1, roughStrength: 1, roughContrast: 2, normalStrength: 1, normalContrast: 1 });
    expect('unknown' in result).toBe(false);
  });

  it('viewport-layout R14 the Normal strength and contrast are clamped to 0-3, and settings saved before they existed read them as 1', () => {
    expect(clampViewportSettings({ mapAdjust: { normalStrength: 9, normalContrast: -2 } }).mapAdjust).toMatchObject({ normalStrength: 3, normalContrast: 0 });
    expect(clampViewportSettings({ mapAdjust: { normalStrength: 'big' } }).mapAdjust.normalStrength).toBe(1);
    const saved = { mapAdjust: { metalStrength: 2, metalContrast: 1, roughStrength: 1, roughContrast: 1 } };
    expect(clampViewportSettings(saved).mapAdjust).toMatchObject({ metalStrength: 2, normalStrength: 1, normalContrast: 1 });
  });

  it('R14 anything that is not an object gives the defaults', () => {
    expect(clampViewportSettings(null)).toEqual(DEFAULT_VIEWPORT_SETTINGS);
    expect(clampViewportSettings('x')).toEqual(DEFAULT_VIEWPORT_SETTINGS);
  });
});
