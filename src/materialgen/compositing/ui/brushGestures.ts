import { isResizeGesture } from '../plan/resizeByPointer';

/** Compositing R12: the wheel travel, in pixel units, that makes one notch. */
export const WHEEL_NOTCH = 100;
const LINE_UNITS = 33; // a wheel that reports lines counts 33 pixel units per line

/** True for an element the user types into: the tools' keys never act while one has the focus (compositing R19). */
export function isEditableTarget(target: EventTarget | null): boolean {
  return target instanceof HTMLElement && (target.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName));
}

export interface ModifierTracker {
  remember(event: { altKey: boolean; shiftKey: boolean }): void;
  /** Window blur: a key released elsewhere is never seen, so both go up (compositing R38). */
  clear(): void;
  alt(): boolean;
  shift(): boolean;
}

/** The Alt and Shift state the last pointer or key event showed, for the ghost and the line gestures of both tool modes. */
export function createModifierTracker(): ModifierTracker {
  let state = { alt: false, shift: false };
  return {
    remember: (event) => { state = { alt: event.altKey, shift: event.shiftKey }; },
    clear: () => { state = { alt: false, shift: false }; },
    alt: () => state.alt,
    shift: () => state.shift,
  };
}

export interface ResizeAnchor {
  /** The sideways distance since the last Alt movement, or null when this movement only sets the anchor (or is not the gesture). */
  move(event: { altKey: boolean; ctrlKey: boolean; shiftKey: boolean; buttons: number; clientX: number }, drawing: boolean): number | null;
  reset(): void;
}

/** Compositing R73: tracks where the pointer was at the last Alt movement so a size change follows the sideways travel. */
export function createResizeAnchor(): ResizeAnchor {
  let anchorX: number | null = null;
  return {
    move(event, drawing) {
      if (!isResizeGesture(event) || drawing) {
        anchorX = null;
        return null;
      }
      const from = anchorX;
      anchorX = event.clientX;
      return from === null ? null : event.clientX - from;
    },
    reset: () => { anchorX = null; },
  };
}

export interface WheelNotches {
  /** Adds one wheel event; returns the whole notches it completed, wheel up positive, a reversal restarting the count. */
  add(deltaY: number, deltaMode: number): number;
}

export function createWheelNotches(): WheelNotches {
  let remainder = 0;
  return {
    add(deltaY, deltaMode) {
      const units = deltaMode === 1 ? deltaY * LINE_UNITS : deltaY;
      if (units === 0) return 0;
      if (Math.sign(units) !== Math.sign(remainder)) remainder = 0;
      remainder += units;
      let notches = 0;
      while (Math.abs(remainder) >= WHEEL_NOTCH) {
        const direction = Math.sign(remainder);
        notches -= direction; // wheel up (negative delta) is positive
        remainder -= direction * WHEEL_NOTCH;
      }
      return notches === 0 ? 0 : notches; // never -0
    },
  };
}
