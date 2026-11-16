import { useEffect, useState } from 'react';
import { anchorSelector } from './anchors';
import type { Box } from './placeCard';

const sameBox = (a: Box, b: Box): boolean => a.left === b.left && a.top === b.top && a.width === b.width && a.height === b.height;

function measure(element: Element): Box {
  const { left, top, right, bottom, width, height } = element.getBoundingClientRect();
  return { left, top, right, bottom, width, height };
}

/**
 * The target's box in the window, kept current while it is shown (tutorial R5): re-read on window resize and any scroll, when the element resizes, and once per
 * frame (a panel being dragged or a popover settling moves it without any of those events). Null when there is no target.
 */
export function useAnchorRect(target: Element | null, anchor?: string): Box | null {
  const [box, setBox] = useState<Box | null>(null);

  useEffect(() => {
    if (target === null) {
      setBox(null);
      return;
    }
    let live = true;
    let frame = 0;
    let element: Element = target;
    const observer = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(() => update());
    // A target found just before a view change is replaced by the new view's element with the same anchor; until that one exists the spotlight has no box.
    const resolve = (): Element | null => {
      if (element.isConnected) return element;
      const fresh = anchor === undefined ? null : document.querySelector(anchorSelector(anchor));
      if (fresh === null) return null;
      observer?.unobserve(element);
      element = fresh;
      observer?.observe(element);
      return element;
    };
    const update = (): void => {
      if (!live) return;
      const current = resolve();
      const next = current === null ? null : measure(current);
      setBox((previous) => (previous !== null && next !== null && sameBox(previous, next) ? previous : next));
    };
    const tick = (): void => {
      update();
      if (live) frame = window.requestAnimationFrame(tick);
    };
    update();
    frame = window.requestAnimationFrame(tick);
    window.addEventListener('resize', update);
    window.addEventListener('scroll', update, true);
    observer?.observe(target);
    return () => {
      live = false;
      window.cancelAnimationFrame(frame);
      window.removeEventListener('resize', update);
      window.removeEventListener('scroll', update, true);
      observer?.disconnect();
    };
  }, [target, anchor]);

  return box;
}
