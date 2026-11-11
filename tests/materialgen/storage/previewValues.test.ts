import { describe, expect, it } from 'vitest';
import { DEFAULT_PREVIEW_PREFS, DEFAULT_PREVIEW_VALUES, readPreviewPrefs, readPreviewValues } from '@mat/storage/previewValues';

describe('previewValues', () => {
  it('materialgen/preview R34 tiling is clamped to 1..10 whole numbers and a non-number gives the default', () => {
    expect(readPreviewValues({ tilingX: 50, tilingY: 'x' })).toMatchObject({ tilingX: 10, tilingY: 1 });
    expect(readPreviewValues({ tilingX: 0, tilingY: 2.6 })).toMatchObject({ tilingX: 1, tilingY: 3 });
  });

  it('materialgen/preview R35 heightScale is clamped to 0..0.1 and defaults to 0.02', () => {
    expect(readPreviewValues({ heightScale: -1 }).heightScale).toBe(0);
    expect(readPreviewValues({ heightScale: 5 }).heightScale).toBe(0.1);
    expect(readPreviewValues({}).heightScale).toBe(0.02);
  });

  it('materialgen/preview R36 heightLevel is clamped to 0..1 (default 0.5) and heightContrast to 0..3 (default 1)', () => {
    expect(readPreviewValues({ heightLevel: 2, heightContrast: -4 })).toMatchObject({ heightLevel: 1, heightContrast: 0 });
    expect(readPreviewValues({ heightLevel: Number.NaN, heightContrast: null })).toMatchObject({ heightLevel: 0.5, heightContrast: 1 });
  });

  it('materialgen/preview R34 missing or malformed stored values give the defaults', () => {
    expect(readPreviewValues(undefined)).toEqual(DEFAULT_PREVIEW_VALUES);
    expect(readPreviewValues('nope')).toEqual(DEFAULT_PREVIEW_VALUES);
  });

  it('materialgen/preview R33 an unknown mesh loads as the ball', () => {
    expect(readPreviewPrefs({ mesh: 'cube' }).mesh).toBe('ball');
    expect(readPreviewPrefs({ mesh: 'materialBall' }).mesh).toBe('materialBall');
  });

  it('materialgen/preview R39 meshResolution is a whole number 1..4 and defaults to 2', () => {
    expect(readPreviewPrefs({ meshResolution: 9 }).meshResolution).toBe(4);
    expect(readPreviewPrefs({ meshResolution: 0 }).meshResolution).toBe(1);
    expect(readPreviewPrefs({ meshResolution: 2.4 }).meshResolution).toBe(2);
    expect(readPreviewPrefs({}).meshResolution).toBe(2);
  });

  it('materialgen/preview R37 aoIntensity is clamped to 0..2 (default 1) and R40 maskOverlayOpacity to 0..1 (default 0.5)', () => {
    expect(readPreviewPrefs({ aoIntensity: 7, maskOverlayOpacity: -1 })).toMatchObject({ aoIntensity: 2, maskOverlayOpacity: 0 });
    expect(readPreviewPrefs(undefined)).toEqual(DEFAULT_PREVIEW_PREFS);
    expect(DEFAULT_PREVIEW_PREFS).toMatchObject({ aoIntensity: 1, maskOverlayOpacity: 0.5 });
  });

  it('materialgen/preview R60 normalDirection is opengl or directx, default opengl, and an unknown value loads as opengl', () => {
    expect(DEFAULT_PREVIEW_PREFS.normalDirection).toBe('opengl');
    expect(readPreviewPrefs({ normalDirection: 'directx' }).normalDirection).toBe('directx');
    expect(readPreviewPrefs({ normalDirection: 'metal' }).normalDirection).toBe('opengl');
    expect(readPreviewPrefs({ normalDirection: 3 }).normalDirection).toBe('opengl');
    expect(readPreviewPrefs({}).normalDirection).toBe('opengl');
  });
});
