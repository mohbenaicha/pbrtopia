import { useCallback, useEffect, useRef, useState } from 'react';
import { DEFAULT_PREVIEW_PREFS, readPreviewPrefs, type MaterialProjectStore, type PreviewPrefs } from '@mat/storage';

type PrefsStore = Pick<MaterialProjectStore, 'loadAppSettings' | 'saveAppSettings'>;

const SAVE_DELAY_MS = 400;

const same = (a: PreviewPrefs, b: PreviewPrefs): boolean => a.mesh === b.mesh && a.meshResolution === b.meshResolution && a.aoIntensity === b.aoIntensity && a.maskOverlayOpacity === b.maskOverlayOpacity && a.normalDirection === b.normalDirection;

/**
 * Preview R32, R33, R39, R40, R41: the app-wide viewer prefs (mesh, mesh resolution, AO intensity, mask overlay opacity). Loaded once and clamped; saved
 * 400 ms after the last change and at once when the tab hides or the view is left. A change made before the load finished is ignored so it cannot
 * overwrite what is saved.
 */
export function usePreviewPrefs(store: PrefsStore): { prefs: PreviewPrefs; loaded: boolean; change(patch: Partial<PreviewPrefs>): void; reset(): void } {
  const [prefs, setPrefs] = useState<PreviewPrefs>(DEFAULT_PREVIEW_PREFS);
  const [loaded, setLoaded] = useState(false);
  const current = useRef(prefs);
  const isLoaded = useRef(false);
  const waiting = useRef<PreviewPrefs | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  const write = useCallback((): void => {
    clearTimeout(timer.current);
    const pending = waiting.current;
    waiting.current = null;
    if (pending !== null) void store.saveAppSettings({ previewPrefs: pending });
  }, [store]);

  const keep = useCallback(
    (next: PreviewPrefs): void => {
      if (same(next, current.current)) return;
      current.current = next;
      setPrefs(next);
      waiting.current = next;
      clearTimeout(timer.current);
      timer.current = setTimeout(write, SAVE_DELAY_MS);
    },
    [write],
  );

  useEffect(() => {
    let cancelled = false;
    isLoaded.current = false;
    setLoaded(false);
    void store.loadAppSettings().then((settings) => {
      if (cancelled) return;
      const saved = readPreviewPrefs(settings.previewPrefs);
      current.current = saved;
      setPrefs(saved);
      isLoaded.current = true;
      setLoaded(true);
    });
    const writeWhenHidden = (): void => {
      if (document.hidden) write();
    };
    window.addEventListener('pagehide', write);
    document.addEventListener('visibilitychange', writeWhenHidden); // a tab switch does not fire pagehide
    return () => {
      cancelled = true;
      window.removeEventListener('pagehide', write);
      document.removeEventListener('visibilitychange', writeWhenHidden);
      write();
    };
  }, [store, write]);

  const change = useCallback(
    (patch: Partial<PreviewPrefs>): void => {
      if (isLoaded.current) keep(readPreviewPrefs({ ...current.current, ...patch }));
    },
    [keep],
  );
  const reset = useCallback((): void => {
    if (isLoaded.current) keep({ ...DEFAULT_PREVIEW_PREFS });
  }, [keep]);

  return { prefs, loaded, change, reset };
}
