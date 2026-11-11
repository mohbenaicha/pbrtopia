import { useCallback, useEffect, useRef, useState } from 'react';
import type { SharedProjectStore } from '../projects/SharedProjectStore';
import { clampPanelWidths, DEFAULT_PANEL_WIDTHS, panelLimits, resizePanel, type PanelSide, type PanelWidths } from './panelWidths';

type PanelStore = Pick<SharedProjectStore, 'loadAppSettings' | 'saveAppSettings'>;

/**
 * The side panel widths of the shell (viewport-layout R25): loaded once, kept inside what the window allows, changed live by `resize`
 * and written only by `commit` (the end of a drag, a key press, a reset). A resize before the load finished is ignored.
 */
export function usePanelWidths(store: PanelStore) {
  const [widths, setWidths] = useState<PanelWidths>(DEFAULT_PANEL_WIDTHS);
  const [loaded, setLoaded] = useState(false);
  const current = useRef(widths);
  const isLoaded = useRef(false);

  const show = useCallback((next: PanelWidths): void => {
    current.current = next;
    setWidths(next);
  }, []);

  useEffect(() => {
    let cancelled = false;
    void store.loadAppSettings().then(({ panels }) => {
      if (cancelled) return;
      show(clampPanelWidths({ left: panels.leftPx ?? DEFAULT_PANEL_WIDTHS.left, right: panels.rightPx ?? DEFAULT_PANEL_WIDTHS.right }, window.innerWidth));
      isLoaded.current = true;
      setLoaded(true);
    });
    const fitWindow = (): void => show(clampPanelWidths(current.current, window.innerWidth));
    window.addEventListener('resize', fitWindow);
    return () => {
      cancelled = true;
      window.removeEventListener('resize', fitWindow);
    };
  }, [store, show]);

  const resize = useCallback(
    (side: PanelSide, px: number): void => {
      if (isLoaded.current) show(resizePanel(current.current, side, px, window.innerWidth));
    },
    [show],
  );

  const commit = useCallback((): void => {
    if (!isLoaded.current) return;
    void store.saveAppSettings({ panels: { leftPx: current.current.left, rightPx: current.current.right } });
  }, [store]);

  const reset = useCallback(
    (side: PanelSide): void => {
      resize(side, DEFAULT_PANEL_WIDTHS[side]);
      commit();
    },
    [resize, commit],
  );

  const limits = useCallback((side: PanelSide) => panelLimits(side, current.current, window.innerWidth), []);

  return { widths, loaded, resize, commit, reset, limits };
}
