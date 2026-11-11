// @vitest-environment jsdom
import { act, cleanup, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { PreviewMaps } from '../../../../src/materialgen/preview/material/previewMaps';
import { THUMBNAIL_DELAY_MS, usePreviewThumbnail } from '../../../../src/materialgen/preview/ui/usePreviewThumbnail';

const picture = { width: 2, height: 2, channels: 1 as const, data: new Uint8Array(4) };
const blob = new Blob(['jpeg']);

beforeEach(() => vi.useFakeTimers());
afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

const setup = (maps: PreviewMaps, enabled = true, loaded = true) => {
  const scene = { captureThumbnail: vi.fn(async (capture: () => Promise<Blob>) => capture()) };
  const capture = vi.fn(async () => blob);
  const save = vi.fn(async () => undefined);
  const view = renderHook((props: { maps: PreviewMaps; enabled: boolean; loaded?: boolean }) => usePreviewThumbnail({ scene, capture, maps: props.maps, loaded: props.loaded ?? true, enabled: props.enabled, save }), {
    initialProps: { maps, enabled, loaded } as { maps: PreviewMaps; enabled: boolean; loaded?: boolean },
  });
  return { scene, capture, save, view };
};

describe('materialgen/preview R54 when the thumbnail is saved', () => {
  it('R54 a material with no maps gets none, on a map change or on closing', async () => {
    const { save, view } = setup({});
    await act(() => vi.advanceTimersByTimeAsync(THUMBNAIL_DELAY_MS * 2));
    await act(async () => void (await view.result.current()));
    expect(save).not.toHaveBeenCalled();
  });

  it('R54 the first autosave after the maps change saves one thumbnail of the capture', async () => {
    const { save, scene, view } = setup({});
    view.rerender({ maps: { albedo: picture }, enabled: true });
    expect(save).not.toHaveBeenCalled(); // not before the delay
    await act(() => vi.advanceTimersByTimeAsync(THUMBNAIL_DELAY_MS));
    expect(scene.captureThumbnail).toHaveBeenCalledTimes(1);
    expect(save).toHaveBeenCalledWith(blob);
  });

  it('R54 showing the maps when the project opens is not a change: no thumbnail is waiting after the load', async () => {
    const { save, view } = setup({}, true, false);
    view.rerender({ maps: { albedo: picture }, enabled: true, loaded: true });
    await act(() => vi.advanceTimersByTimeAsync(THUMBNAIL_DELAY_MS * 2));
    expect(save).not.toHaveBeenCalled();
    view.rerender({ maps: { albedo: picture, normal: picture }, enabled: true, loaded: true });
    await act(() => vi.advanceTimersByTimeAsync(THUMBNAIL_DELAY_MS));
    expect(save).toHaveBeenCalledTimes(1);
  });

  it('R54 a burst of map changes saves once, after the last', async () => {
    const { save, view } = setup({});
    view.rerender({ maps: { albedo: picture }, enabled: true });
    await act(() => vi.advanceTimersByTimeAsync(THUMBNAIL_DELAY_MS - 10));
    view.rerender({ maps: { albedo: picture, normal: picture }, enabled: true });
    await act(() => vi.advanceTimersByTimeAsync(THUMBNAIL_DELAY_MS - 10));
    expect(save).not.toHaveBeenCalled();
    await act(() => vi.advanceTimersByTimeAsync(20));
    expect(save).toHaveBeenCalledTimes(1);
  });

  it('R54 closing the project saves now, and cancels the waiting save so it is not written twice', async () => {
    const { save, view } = setup({ albedo: picture });
    view.rerender({ maps: { albedo: picture, normal: picture }, enabled: true });
    await act(async () => void (await view.result.current()));
    expect(save).toHaveBeenCalledTimes(1);
    await act(() => vi.advanceTimersByTimeAsync(THUMBNAIL_DELAY_MS * 2));
    expect(save).toHaveBeenCalledTimes(1);
  });

  it('R54 a project this tab may not write saves nothing', async () => {
    const { save, view } = setup({ albedo: picture }, false);
    view.rerender({ maps: { albedo: picture, normal: picture }, enabled: false });
    await act(() => vi.advanceTimersByTimeAsync(THUMBNAIL_DELAY_MS * 2));
    await act(async () => void (await view.result.current()));
    expect(save).not.toHaveBeenCalled();
  });

  it('R53 a failed capture or write never throws to the caller', async () => {
    const { save, view } = setup({ albedo: picture });
    save.mockRejectedValueOnce(new Error('quota'));
    await act(async () => void (await view.result.current()));
    expect(save).toHaveBeenCalledTimes(1);
  });

  it('R54 with no scene yet there is nothing to capture', async () => {
    const save = vi.fn();
    const view = renderHook(() => usePreviewThumbnail({ scene: null, capture: null, maps: { albedo: picture }, loaded: true, enabled: true, save }));
    await act(async () => void (await view.result.current()));
    expect(save).not.toHaveBeenCalled();
  });
});
