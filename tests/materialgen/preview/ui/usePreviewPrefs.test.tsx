// @vitest-environment jsdom
import { act, cleanup, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { DEFAULT_PREVIEW_PREFS, type PreviewPrefs } from '@mat/storage';
import { usePreviewPrefs } from '../../../../src/materialgen/preview/ui/usePreviewPrefs';

beforeEach(() => vi.useFakeTimers());
afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

function setup(stored: unknown = DEFAULT_PREVIEW_PREFS) {
  const saved: Array<Partial<{ previewPrefs: PreviewPrefs }>> = [];
  const store = {
    loadAppSettings: vi.fn(async () => ({ previewPrefs: stored }) as never),
    saveAppSettings: vi.fn(async (patch: Partial<{ previewPrefs: PreviewPrefs }>) => {
      saved.push(patch);
      return { ok: true as const, value: undefined };
    }),
  };
  const view = renderHook(() => usePreviewPrefs(store));
  return { view, saved, store };
}

describe('materialgen/preview R32 R33 R39 R40 app-wide prefs', () => {
  it('R32 loads the saved prefs, clamped, and shows the defaults until then', async () => {
    const { view } = setup({ mesh: 'plane', meshResolution: 99, aoIntensity: -3 });
    expect(view.result.current.prefs).toEqual(DEFAULT_PREVIEW_PREFS);
    await act(async () => void (await vi.advanceTimersByTimeAsync(0)));
    expect(view.result.current.prefs).toEqual({ ...DEFAULT_PREVIEW_PREFS, mesh: 'plane', meshResolution: 4, aoIntensity: 0 });
  });

  it('R32 a burst of changes is saved once, 400 ms after the last one', async () => {
    const { view, saved } = setup();
    await act(async () => void (await vi.advanceTimersByTimeAsync(0)));
    act(() => view.result.current.change({ aoIntensity: 0.5 }));
    await act(async () => void (await vi.advanceTimersByTimeAsync(300)));
    act(() => view.result.current.change({ aoIntensity: 1.5 }));
    await act(async () => void (await vi.advanceTimersByTimeAsync(399)));
    expect(saved).toHaveLength(0);
    await act(async () => void (await vi.advanceTimersByTimeAsync(1)));
    expect(saved).toEqual([{ previewPrefs: { ...DEFAULT_PREVIEW_PREFS, aoIntensity: 1.5 } }]);
  });

  it('R32 the tab hiding writes what is waiting at once', async () => {
    const { view, saved } = setup();
    await act(async () => void (await vi.advanceTimersByTimeAsync(0)));
    act(() => view.result.current.change({ mesh: 'materialBall' }));
    act(() => void window.dispatchEvent(new Event('pagehide')));
    expect(saved).toHaveLength(1);
  });

  it('R32 switching to another tab (the page becomes hidden) writes what is waiting at once; becoming visible writes nothing', async () => {
    const { view, saved } = setup();
    await act(async () => void (await vi.advanceTimersByTimeAsync(0)));
    act(() => view.result.current.change({ mesh: 'plane' }));
    const hidden = vi.spyOn(document, 'hidden', 'get');
    hidden.mockReturnValue(false);
    act(() => void document.dispatchEvent(new Event('visibilitychange')));
    expect(saved).toHaveLength(0);
    hidden.mockReturnValue(true);
    act(() => void document.dispatchEvent(new Event('visibilitychange')));
    expect(saved).toHaveLength(1);
    hidden.mockRestore();
  });

  it('R32 leaving writes what is waiting', async () => {
    const { view, saved } = setup();
    await act(async () => void (await vi.advanceTimersByTimeAsync(0)));
    act(() => view.result.current.change({ meshResolution: 3 }));
    view.unmount();
    expect(saved).toHaveLength(1);
  });

  it('R32 a change made before the load finished is ignored, so it cannot overwrite the saved prefs', async () => {
    const { view, saved } = setup({ mesh: 'plane' });
    act(() => view.result.current.change({ aoIntensity: 2 }));
    await act(async () => void (await vi.advanceTimersByTimeAsync(1000)));
    expect(saved).toHaveLength(0);
    expect(view.result.current.prefs.mesh).toBe('plane');
  });

  it('R41 reset puts every pref back to its default in one save', async () => {
    const { view, saved } = setup({ mesh: 'plane', meshResolution: 4, aoIntensity: 2, maskOverlayOpacity: 1 });
    await act(async () => void (await vi.advanceTimersByTimeAsync(0)));
    act(() => view.result.current.reset());
    expect(view.result.current.prefs).toEqual(DEFAULT_PREVIEW_PREFS);
    await act(async () => void (await vi.advanceTimersByTimeAsync(400)));
    expect(saved).toEqual([{ previewPrefs: DEFAULT_PREVIEW_PREFS }]);
  });

  it('R41 reset when nothing differs writes nothing', async () => {
    const { view, saved } = setup();
    await act(async () => void (await vi.advanceTimersByTimeAsync(0)));
    act(() => view.result.current.reset());
    await act(async () => void (await vi.advanceTimersByTimeAsync(1000)));
    expect(saved).toHaveLength(0);
  });
});
