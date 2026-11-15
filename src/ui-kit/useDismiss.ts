import { useEffect, useRef, type RefObject } from 'react';

const openLayers: object[] = []; // the dismissable layers that are open, the last opened on top (viewport-layout R38)

// Calls onDismiss when Escape is pressed, and (if outside is true) when the pointer goes down outside `region`.
// Shared by every floating control so they all close the same way. Escape and an outside press reach only the topmost open layer, so a list inside a dialog
// closes alone and a dialog opened from inside another never closes the one behind it (viewport-layout R38, export R44).
export function useDismiss(open: boolean, region: RefObject<HTMLElement | null>, onDismiss: () => void, outside = true): void {
  const latest = useRef(onDismiss);
  latest.current = onDismiss;

  useEffect(() => {
    if (!open) return undefined;
    const layer = {};
    openLayers.push(layer);
    const isTopmost = (): boolean => openLayers[openLayers.length - 1] === layer;
    const onKeyDown = (event: KeyboardEvent): void => {
      if (event.key === 'Escape' && isTopmost()) latest.current();
    };
    const onPointerDown = (event: PointerEvent): void => {
      if (outside && isTopmost() && region.current && !region.current.contains(event.target as Node)) latest.current();
    };
    document.addEventListener('keydown', onKeyDown);
    document.addEventListener('pointerdown', onPointerDown);
    return () => {
      openLayers.splice(openLayers.indexOf(layer), 1);
      document.removeEventListener('keydown', onKeyDown);
      document.removeEventListener('pointerdown', onPointerDown);
    };
  }, [open, region, outside]);
}
