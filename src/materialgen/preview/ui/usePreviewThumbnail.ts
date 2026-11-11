import { useCallback, useEffect, useRef } from 'react';
import type { PreviewMaps } from '../material/previewMaps';
import type { PreviewScene } from '../scene/createPreviewScene';

export const THUMBNAIL_DELAY_MS = 1500; // the maps are shown and quiet before the picture is taken, so a burst of edits makes one thumbnail

interface PreviewThumbnailInputs {
  scene: Pick<PreviewScene, 'captureThumbnail'> | null;
  capture: (() => Promise<Blob>) | null; // the viewport's own capture of what is drawn now
  maps: PreviewMaps;
  loaded: boolean; // the first load of the maps has finished
  enabled: boolean; // this tab may write the project
  save(jpeg: Blob): Promise<unknown>;
}

/**
 * Preview R53, R54: saves the project thumbnail once after the maps change (not when they are first shown on opening) and then stay quiet for a moment (the autosave of the maps), and again whenever the
 * returned function is called, which is how closing the project asks for it. A material with no maps gets none. A failed capture or write is not worth
 * interrupting the user, so nothing here throws.
 */
export function usePreviewThumbnail(inputs: PreviewThumbnailInputs): () => Promise<void> {
  const latest = useRef(inputs);
  latest.current = inputs;
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const cancel = useCallback((): void => {
    if (timer.current !== null) clearTimeout(timer.current);
    timer.current = null;
  }, []);

  const saveNow = useCallback(async (): Promise<void> => {
    cancel();
    const { scene, capture, maps, enabled, save } = latest.current;
    if (!enabled || scene === null || capture === null || Object.keys(maps).length === 0) return;
    try {
      await save(await scene.captureThumbnail(capture));
    } catch {
      // a missing thumbnail leaves the project list's placeholder
    }
  }, [cancel]);

  const { maps, loaded, enabled, scene } = inputs;
  const opened = useRef<PreviewMaps | null>(null); // the maps as the project opened: showing them is not a change
  useEffect(() => {
    if (!loaded) return undefined;
    if (opened.current === null) opened.current = maps;
    if (maps === opened.current || !enabled || scene === null || Object.keys(maps).length === 0) return undefined;
    timer.current = setTimeout(() => void saveNow(), THUMBNAIL_DELAY_MS);
    return cancel;
  }, [maps, loaded, enabled, scene, saveNow, cancel]);

  return saveNow;
}
