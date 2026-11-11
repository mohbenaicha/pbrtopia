import { useEffect, useRef } from 'react';
import { ASSIGNMENT_OVERLAY_CLASS } from '@shared/generation';
import { buildCardModel, findEditedSlot, type MapKind, type MapsState, type Slot } from '@mat/maps';
import type { ColorMode } from '@mat/storage';

interface UndoShortcutInput {
  state: MapsState;
  colorMode: ColorMode;
  canWrite: boolean;
  busy: boolean; // a map is being changed: the card's Undo is disabled
  undo(kinds: readonly MapKind[]): void;
}

// R47 says "text field": a slider, checkbox, switch or select keeps focus after use and must not switch Ctrl+Z off.
const EDITABLE = 'input:not([type="range"], [type="checkbox"], [type="radio"], [type="button"], [type="submit"], [type="color"]), textarea, [contenteditable=""], [contenteditable="true"]';
const COVERING = `[role="dialog"], [aria-modal="true"], .${ASSIGNMENT_OVERLAY_CLASS}`; // a dialog, a viewer or the setup overlay is open

/** Materialgen app R47: Ctrl+Z (Cmd+Z) undoes the card last edited in this session, and only where that card's Undo button could act. */
export function useUndoShortcut({ state, colorMode, canWrite, busy, undo }: UndoShortcutInput): void {
  const lastEdited = useRef<Slot | null>(null);
  const previous = useRef(state);
  useEffect(() => {
    lastEdited.current = findEditedSlot(previous.current, state) ?? lastEdited.current;
    previous.current = state;
  }, [state]);

  const latest = useRef({ state, colorMode, canWrite, busy, undo });
  latest.current = { state, colorMode, canWrite, busy, undo };
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent): void => {
      if (event.repeat || event.key.toLowerCase() !== 'z' || !(event.ctrlKey || event.metaKey) || event.shiftKey || event.altKey) return;
      const { state: current, colorMode: mode, canWrite: writable, busy: working, undo: run } = latest.current;
      const slot = lastEdited.current;
      if (slot === null || !writable || working) return;
      if (event.target instanceof Element && event.target.closest(EDITABLE)) return;
      if (document.querySelector(COVERING)) return;
      const model = buildCardModel(current, slot, mode).undo;
      if (!model.enabled) return;
      event.preventDefault();
      run(model.kinds);
    };
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, []);
}
