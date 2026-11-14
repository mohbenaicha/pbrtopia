import { describe, expect, it } from 'vitest';
import { DEFAULT_PANEL_WIDTHS, PANEL_GAPS_PX, clampPanelWidths, panelLimits, resizePanel } from '../../src/shell/panelWidths';

describe('panel widths', () => {
  it('viewport-layout R25 the defaults are 296 on the left and 288 on the right', () => {
    expect(DEFAULT_PANEL_WIDTHS).toEqual({ left: 296, right: 288 });
  });

  it('viewport-layout R25 each width is held to its own range: left 220 to 520, right 240 to 560', () => {
    const wide = 3000;
    expect(clampPanelWidths({ left: 100, right: 100 }, wide)).toEqual({ left: 220, right: 240 });
    expect(clampPanelWidths({ left: 900, right: 900 }, wide)).toEqual({ left: 520, right: 560 });
    expect(clampPanelWidths({ left: 300, right: 400 }, wide)).toEqual({ left: 300, right: 400 });
  });

  it('viewport-layout R25 a panel stops growing where the viewport would get narrower than 360 px', () => {
    const window = 1000;
    const { max: leftMax } = panelLimits('left', { left: 300, right: 400 }, window);
    const viewportWidth = (left: number): number => window - left - 400 - PANEL_GAPS_PX;
    expect(viewportWidth(leftMax)).toBeGreaterThanOrEqual(360);
    expect(viewportWidth(leftMax + 1)).toBeLessThan(360);
    expect(resizePanel({ left: 300, right: 400 }, 'left', 520, window).left).toBe(leftMax);
  });

  it('viewport-layout R25 resizing one panel leaves the other as it was', () => {
    expect(resizePanel({ left: 300, right: 400 }, 'right', 350, 3000)).toEqual({ left: 300, right: 350 });
    expect(resizePanel({ left: 300, right: 400 }, 'left', 100, 3000)).toEqual({ left: 220, right: 400 });
  });

  it('viewport-layout R25 in a window narrower than the smallest layout the panels keep their minimum widths', () => {
    expect(clampPanelWidths({ left: 400, right: 400 }, 600)).toEqual({ left: 220, right: 240 });
    expect(panelLimits('left', { left: 220, right: 240 }, 600)).toEqual({ min: 220, max: 220 });
    expect(panelLimits('right', { left: 220, right: 240 }, 600)).toEqual({ min: 240, max: 240 });
  });

  it('viewport-layout R25 saved widths that do not fit the window are shrunk when it is resized: the right panel first, then the left', () => {
    const fits = clampPanelWidths({ left: 520, right: 560 }, 1500);
    expect(1500 - fits.left - fits.right - PANEL_GAPS_PX).toBeGreaterThanOrEqual(360);
    expect(fits.left).toBe(520);
    const tight = clampPanelWidths({ left: 520, right: 560 }, 900);
    expect(tight.right).toBe(240);
    expect(900 - tight.left - tight.right - PANEL_GAPS_PX).toBeGreaterThanOrEqual(360);
  });

  it('viewport-layout R25 a width that is not a finite number is replaced by the default', () => {
    expect(clampPanelWidths({ left: Number.NaN, right: Number.POSITIVE_INFINITY }, 3000)).toEqual({ left: 296, right: 288 });
  });

  it('compositing R47 a screen can raise a panel minimum (never lower it); the other panel and the default screens are unchanged', () => {
    const floors = { left: 300 } as const;
    expect(clampPanelWidths({ left: 100, right: 100 }, 3000, floors)).toEqual({ left: 300, right: 240 });
    expect(resizePanel({ left: 400, right: 400 }, 'left', 100, 3000, floors)).toEqual({ left: 300, right: 400 });
    expect(panelLimits('left', { left: 300, right: 240 }, 3000, floors)).toEqual({ min: 300, max: 520 });
    expect(clampPanelWidths({ left: 100, right: 100 }, 3000, { left: 100 })).toEqual({ left: 220, right: 240 });
    expect(clampPanelWidths({ left: Number.NaN, right: 288 }, 3000, floors)).toEqual({ left: 300, right: 288 });
  });
});
