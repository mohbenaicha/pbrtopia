import { useCallback, useEffect, useRef, useState } from 'react';
import type { SharedProjectStore } from '../projects/SharedProjectStore';
import { clampViewportSettings, DEFAULT_VIEWPORT_SETTINGS, type Viewport, type ViewportSettings } from '../viewport';
import { loadViewportSettings, saveViewportSettings } from './viewportSettingsPersistence';

export type SettingsViewport = Pick<Viewport, 'setSettings' | 'on'>;

interface ViewportSettingsOptions {
  saveDelayMs?: number; // quiet time before a change is written; one write per burst of slider moves
}

const DEFAULT_SAVE_DELAY_MS = 400;

/**
 * The viewport settings for one view: loaded once, applied to the viewport, changed from the gear popover, and saved after a quiet time.
 * A change made before the load finished is ignored.
 */
export function useViewportSettings(store: Pick<SharedProjectStore, 'loadAppSettings' | 'saveAppSettings'>, viewport: SettingsViewport | null, options: ViewportSettingsOptions = {}) {
  const saveDelayMs = options.saveDelayMs ?? DEFAULT_SAVE_DELAY_MS;
  const [settings, setSettings] = useState<ViewportSettings>(DEFAULT_VIEWPORT_SETTINGS);
  const [loaded, setLoaded] = useState(false);
  const current = useRef(settings);
  const isLoaded = useRef(false);
  const waiting = useRef<ViewportSettings | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  const writeWaiting = useCallback((): void => {
    clearTimeout(timer.current);
    const pending = waiting.current;
    waiting.current = null;
    if (pending !== null) void saveViewportSettings(store, pending);
  }, [store]);

  const keep = useCallback(
    (next: ViewportSettings): void => {
      current.current = next;
      setSettings(next);
      waiting.current = next;
      clearTimeout(timer.current);
      timer.current = setTimeout(writeWaiting, saveDelayMs);
    },
    [saveDelayMs, writeWaiting],
  );

  useEffect(() => {
    let cancelled = false;
    isLoaded.current = false;
    setLoaded(false);
    void loadViewportSettings(store).then((saved) => {
      if (cancelled) return;
      current.current = saved;
      setSettings(saved);
      viewport?.setSettings(saved);
      isLoaded.current = true;
      setLoaded(true);
    });
    const stopListening = viewport?.on('settings-changed', (changed) => {
      if (isLoaded.current) keep(changed);
    });
    window.addEventListener('pagehide', writeWaiting);
    return () => {
      cancelled = true;
      stopListening?.();
      window.removeEventListener('pagehide', writeWaiting);
      writeWaiting();
    };
  }, [store, viewport, keep, writeWaiting]);

  const change = useCallback(
    (patch: Partial<ViewportSettings>): void => {
      if (!isLoaded.current) return;
      keep(clampViewportSettings({ ...current.current, ...patch }));
      viewport?.setSettings(patch);
    },
    [viewport, keep],
  );

  return { settings, loaded, change };
}
