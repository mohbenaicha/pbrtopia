import { describe, expect, it, vi } from 'vitest';
import { DEFAULT_VIEWPORT_SETTINGS } from '@shared/viewport';
import { adaptViewportForPreview } from '../../../../src/materialgen/preview/ui/adaptViewportForPreview';

describe('materialgen/preview R29 R30 settings the preview ignores', () => {
  it('R30 a record saved by the projection app with an orthographic camera, a grid, wireframe and flat shading draws a perspective camera and no grid, wireframe or faceting', () => {
    const setSettings = vi.fn();
    const adapted = adaptViewportForPreview({ setSettings, on: vi.fn() });
    adapted.setSettings({ ...DEFAULT_VIEWPORT_SETTINGS, projection: 'orthographic', grid: true, wireframe: true, flatShading: true, smoothAngleDeg: 30, hdri: 'studio' });
    expect(setSettings).toHaveBeenCalledWith(expect.objectContaining({ projection: 'perspective', grid: false, wireframe: false, flatShading: false, smoothAngleDeg: 180, hdri: 'studio' }));
  });

  it('R30 a patch that does not mention those values still keeps them off', () => {
    const setSettings = vi.fn();
    adaptViewportForPreview({ setSettings, on: vi.fn() }).setSettings({ environmentIntensity: 2 });
    expect(setSettings).toHaveBeenCalledWith(expect.objectContaining({ environmentIntensity: 2, projection: 'perspective', grid: false }));
  });

  it('R44 the other settings (HDRI, light, background, map adjust) pass through unchanged', () => {
    const setSettings = vi.fn();
    const mapAdjust = { ...DEFAULT_VIEWPORT_SETTINGS.mapAdjust, roughStrength: 2 };
    adaptViewportForPreview({ setSettings, on: vi.fn() }).setSettings({ environmentRotationDeg: 90, backgroundVisible: true, mapAdjust });
    expect(setSettings).toHaveBeenCalledWith(expect.objectContaining({ environmentRotationDeg: 90, backgroundVisible: true, mapAdjust }));
  });

  it('R30 the viewport events pass through', () => {
    const on = vi.fn();
    expect(adaptViewportForPreview({ setSettings: vi.fn(), on }).on).toBe(on);
  });
});
