import { useCallback, useEffect, useRef, useState } from 'react';

interface HeldValue {
  id: string;
  value: number;
}

export interface CommitOnRelease {
  /** Put on the element that holds the controls: a press on it starts a hold that ends at the next pointer release or cancel, anywhere on the page. */
  onPointerDown: () => void;
  /** What a control reports: at once with no pointer held, otherwise kept until the release. */
  report: (id: string, value: number) => void;
  /** The value the held control shows until the release, if it is the one being held. */
  heldValueOf: (id: string) => number | undefined;
}

/** Imageops R86: a control follows the pointer while it is held, and its last value is committed once when the pointer is released. */
export function useCommitOnRelease(commit: (id: string, value: number) => void): CommitOnRelease {
  const [held, setHeld] = useState<HeldValue | null>(null);
  const pending = useRef<HeldValue | null>(null);
  const holding = useRef(false);
  const latest = useRef(commit);
  latest.current = commit;

  const release = useCallback((): void => {
    holding.current = false;
    window.removeEventListener('pointerup', release);
    window.removeEventListener('pointercancel', release);
    const last = pending.current;
    pending.current = null;
    setHeld(null);
    if (last !== null) latest.current(last.id, last.value);
  }, []);

  useEffect(() => () => {
    window.removeEventListener('pointerup', release);
    window.removeEventListener('pointercancel', release);
  }, [release]);

  return {
    onPointerDown: () => {
      holding.current = true;
      window.addEventListener('pointerup', release);
      window.addEventListener('pointercancel', release);
    },
    report: (id, value) => {
      if (!holding.current) return commit(id, value);
      pending.current = { id, value };
      setHeld({ id, value });
    },
    heldValueOf: (id) => (held?.id === id ? held.value : undefined),
  };
}
