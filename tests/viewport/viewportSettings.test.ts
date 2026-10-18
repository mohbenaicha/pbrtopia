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
      mapAdjust: { metalStrength: 1, metalContrast: 1, roughStrength: 1, roughContrast: 1 },
    });
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
    expect(result.mapAdjust).toEqual({ metalStrength: 0, metalContrast: 1, roughStrength: 1, roughContrast: 2 });
    expect('unknown' in result).toBe(false);
  });

  it('R14 anything that is not an object gives the defaults', () => {
    expect(clampViewportSettings(null)).toEqual(DEFAULT_VIEWPORT_SETTINGS);
    expect(clampViewportSettings('x')).toEqual(DEFAULT_VIEWPORT_SETTINGS);
  });
});
