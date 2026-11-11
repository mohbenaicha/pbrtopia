// @vitest-environment jsdom
import { act, cleanup, renderHook, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { usePanelWidths } from '../../src/shell/usePanelWidths';
import { DEFAULT_APP_SETTINGS, type AppSettingsRecord } from '../../src/projects/records/appSettingsRecord';

afterEach(cleanup);

function setWindowWidth(width: number): void {
  Object.defineProperty(window, 'innerWidth', { configurable: true, value: width });
}

beforeEach(() => setWindowWidth(1600));

function fakeStore(saved: Partial<AppSettingsRecord> = {}) {
  const saveAppSettings = vi.fn(async () => ({ ok: true as const, value: undefined }));
  return { loadAppSettings: async () => ({ ...DEFAULT_APP_SETTINGS, ...saved }), saveAppSettings };
}

describe('usePanelWidths', () => {
  it('viewport-layout R25 it starts at the defaults and takes the saved widths once they are loaded', async () => {
    const { result } = renderHook(() => usePanelWidths(fakeStore({ panels: { leftPx: 340, rightPx: 310 } })));
    expect(result.current.widths).toEqual({ left: 296, right: 288 });
    await waitFor(() => expect(result.current.widths).toEqual({ left: 340, right: 310 }));
  });

  it('viewport-layout R25 saved widths that are null or no longer fit the window are corrected when loaded', async () => {
    setWindowWidth(900);
    const { result } = renderHook(() => usePanelWidths(fakeStore({ panels: { leftPx: 520, rightPx: null } })));
    await waitFor(() => expect(result.current.loaded).toBe(true));
    expect(result.current.widths.left).toBeLessThan(520);
    expect(900 - result.current.widths.left - result.current.widths.right - 8).toBeGreaterThanOrEqual(360);
  });

  it('viewport-layout R25 resizing changes the width at once and saves only when committed', async () => {
    const store = fakeStore();
    const { result } = renderHook(() => usePanelWidths(store));
    await waitFor(() => expect(result.current.loaded).toBe(true));
    act(() => result.current.resize('left', 350));
    act(() => result.current.resize('left', 380));
    expect(result.current.widths.left).toBe(380);
    expect(store.saveAppSettings).not.toHaveBeenCalled();
    act(() => result.current.commit());
    expect(store.saveAppSettings).toHaveBeenCalledTimes(1);
    expect(store.saveAppSettings).toHaveBeenCalledWith({ panels: { leftPx: 380, rightPx: 288 } });
  });

  it('viewport-layout R25 reset puts one panel back to its default and saves, leaving the other', async () => {
    const store = fakeStore({ panels: { leftPx: 400, rightPx: 350 } });
    const { result } = renderHook(() => usePanelWidths(store));
    await waitFor(() => expect(result.current.widths.left).toBe(400));
    act(() => result.current.reset('right'));
    expect(result.current.widths).toEqual({ left: 400, right: 288 });
    expect(store.saveAppSettings).toHaveBeenLastCalledWith({ panels: { leftPx: 400, rightPx: 288 } });
  });

  it('viewport-layout R25 a resize before the saved widths are loaded is ignored', () => {
    const store = fakeStore();
    const { result } = renderHook(() => usePanelWidths(store));
    act(() => result.current.resize('left', 400));
    expect(result.current.widths.left).toBe(296);
  });

  it('viewport-layout R25 shrinking the window shrinks the widths to fit, without saving', async () => {
    const store = fakeStore({ panels: { leftPx: 500, rightPx: 500 } });
    const { result } = renderHook(() => usePanelWidths(store));
    await waitFor(() => expect(result.current.widths.left).toBe(500));
    act(() => {
      setWindowWidth(1000);
      window.dispatchEvent(new Event('resize'));
    });
    const { left, right } = result.current.widths;
    expect(1000 - left - right - 8).toBeGreaterThanOrEqual(360);
    expect(store.saveAppSettings).not.toHaveBeenCalled();
  });

  it('viewport-layout R25 limits report the range a panel can move in right now', async () => {
    const { result } = renderHook(() => usePanelWidths(fakeStore()));
    await waitFor(() => expect(result.current.loaded).toBe(true));
    expect(result.current.limits('left')).toEqual({ min: 220, max: 520 });
    expect(result.current.limits('right')).toEqual({ min: 240, max: 560 });
  });
});
