import { useEffect, useRef } from 'react';

/** What a component that owns something the tour may show (a popover, a dialog) offers the tour (tutorial R4). */
export interface RevealHandlers {
  open: () => void;
  close: () => void;
}

const owners = new Map<string, { current: RevealHandlers }>();

/** Opens what is registered under `id`; false when nobody (not yet mounted) owns it. */
export function openReveal(id: string): boolean {
  const owner = owners.get(id);
  if (owner === undefined) return false;
  owner.current.open();
  return true;
}

export function closeReveal(id: string): void {
  owners.get(id)?.current.close();
}

/** The owner registers while mounted, so the tour can open and close its popover or dialog; the newest handlers are always the ones called. */
export function useRevealOnTour(id: string, handlers: RevealHandlers): void {
  const latest = useRef(handlers);
  latest.current = handlers;
  useEffect(() => {
    owners.set(id, latest);
    return () => {
      if (owners.get(id) === latest) owners.delete(id);
    };
  }, [id]);
}
