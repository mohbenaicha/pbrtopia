import { useEffect, useRef, type RefObject } from 'react';

// Calls onDismiss when Escape is pressed, and (if outside is true) when the pointer goes down outside `region`.
// Shared by every floating control so they all close the same way.
export function useDismiss(open: boolean, region: RefObject<HTMLElement | null>, onDismiss: () => void, outside = true): void {
  const latest = useRef(onDismiss);
  latest.current = onDismiss;

  useEffect(() => {
    if (!open) return undefined;
    const onKeyDown = (event: KeyboardEvent): void => {
      if (event.key === 'Escape') latest.current();
    };
    const onPointerDown = (event: PointerEvent): void => {
      if (outside && region.current && !region.current.contains(event.target as Node)) latest.current();
    };
    document.addEventListener('keydown', onKeyDown);
    document.addEventListener('pointerdown', onPointerDown);
    return () => {
      document.removeEventListener('keydown', onKeyDown);
      document.removeEventListener('pointerdown', onPointerDown);
    };
  }, [open, region, outside]);
}
