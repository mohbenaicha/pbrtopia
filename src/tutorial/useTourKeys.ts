import { useEffect, type RefObject } from 'react';

interface TourKeyActions {
  next: () => void;
  previous: () => void;
  exit: () => void;
  card: RefObject<HTMLElement | null>;
}

/** Pointer events that never reach the app under the tour (tutorial R7); the card's own hover and click still work. */
const BLOCKED_OUTSIDE = ['pointerup', 'mouseup', 'dblclick', 'contextmenu', 'auxclick', 'touchstart', 'touchend', 'touchmove', 'dragstart', 'pointerover', 'pointerout', 'pointermove', 'mouseover', 'mouseout', 'mousemove', 'keyup', 'keypress'];
/** A press never reaches the document, even on the card: a popover the tour opened would take it for a click outside and close. */
const BLOCKED_EVERYWHERE = ['pointerdown', 'mousedown'];

/**
 * While the tour runs: Right, Left and Escape drive it, a click anywhere outside the card goes to the next step, Tab stays on the card, and nothing else reaches
 * the app (tutorial R7). Window capture listeners, so they run before any popover, dialog or shortcut listener.
 */
export function useTourKeys(active: boolean, { next, previous, exit, card }: TourKeyActions): void {
  useEffect(() => {
    if (!active) return;
    const inCard = (event: Event): boolean => event.target instanceof Node && card.current?.contains(event.target) === true;
    const stop = (event: Event): void => {
      event.stopPropagation();
      event.stopImmediatePropagation();
    };
    const swallow = (event: Event): void => {
      if (inCard(event)) return;
      event.preventDefault();
      stop(event);
    };
    const onPress = (event: Event): void => {
      if (!inCard(event)) event.preventDefault();
      stop(event);
    };
    const onClick = (event: Event): void => {
      if (inCard(event)) return;
      event.preventDefault();
      stop(event);
      next();
    };
    const onWheel = (event: Event): void => {
      if (!inCard(event)) swallow(event);
    };
    const onKey = (event: KeyboardEvent): void => {
      const move = event.key === 'ArrowRight' ? next : event.key === 'ArrowLeft' ? previous : event.key === 'Escape' ? exit : null;
      if (move !== null) {
        event.preventDefault();
        stop(event);
        move();
        return;
      }
      if (event.key === 'Tab' && card.current !== null) {
        const stops = Array.from(card.current.querySelectorAll<HTMLElement>('button:not(:disabled)'));
        const first = stops[0];
        const last = stops[stops.length - 1];
        if (first !== undefined && last !== undefined) {
          const at = document.activeElement;
          if (event.shiftKey && (at === first || !card.current.contains(at))) { event.preventDefault(); last.focus(); }
          else if (!event.shiftKey && (at === last || !card.current.contains(at))) { event.preventDefault(); first.focus(); }
        }
      }
      stop(event); // the app's own shortcuts never see the key; Enter and Space still press the focused button (its default action)
    };

    const options = { capture: true, passive: false } as const;
    window.addEventListener('keydown', onKey, options);
    window.addEventListener('click', onClick, options);
    window.addEventListener('wheel', onWheel, options);
    BLOCKED_EVERYWHERE.forEach((type) => window.addEventListener(type, onPress, options));
    BLOCKED_OUTSIDE.forEach((type) => window.addEventListener(type, swallow, options));
    return () => {
      window.removeEventListener('keydown', onKey, options);
      window.removeEventListener('click', onClick, options);
      window.removeEventListener('wheel', onWheel, options);
      BLOCKED_EVERYWHERE.forEach((type) => window.removeEventListener(type, onPress, options));
      BLOCKED_OUTSIDE.forEach((type) => window.removeEventListener(type, swallow, options));
    };
  }, [active, next, previous, exit, card]);
}
