/** What the controls drive: a drag in pixels and a wheel notch (+1 away, -1 closer). */
export interface TurntableTarget {
  turn(dx: number, dy: number, smallerSide: number): void;
  dolly(direction: number): void;
  setDragging?(active: boolean): void; // a drag started or ended (R53: a thumbnail waits for it)
}

/** Compositing R4: events something else on the element handles (the painter takes the left button and Alt + wheel); the controls leave those alone. */
export interface TurntableFilter {
  ignoresPointer?(event: PointerEvent): boolean;
  ignoresWheel?(event: WheelEvent): boolean;
}

const WHEEL_NOTCH = 100; // wheel units per dolly step
const LINE_UNITS = 33; // a wheel that reports lines rather than pixels: about three lines to a notch

/**
 * Preview R20-R22: left or right button (or one finger) drags to turn, the wheel dollies, the middle button does nothing. A drag ends on release
 * anywhere in the window, and also when a move reports that no button is held, so a release outside the page never leaves the mesh turning.
 * Returns the function that removes the listeners.
 */
export function attachTurntableControls(element: HTMLElement, target: TurntableTarget, filter: () => TurntableFilter | null = () => null): () => void {
  let dragging = false;
  let activeId: number | undefined; // the pointer that started the drag; a second finger is ignored
  let wheelRemainder = 0;
  let lastX = 0;
  let lastY = 0;

  const end = (event?: Event): void => {
    if (!dragging) return;
    if (event !== undefined && (event as PointerEvent).pointerId !== activeId) return; // another finger lifted
    dragging = false;
    target.setDragging?.(false);
  };
  const onDown = (event: MouseEvent): void => {
    if (event.button === 1) {
      event.preventDefault(); // no auto-scroll, and no pan (R21)
      return;
    }
    if (event.button !== 0 && event.button !== 2) return;
    if (filter()?.ignoresPointer?.(event as PointerEvent)) return;
    if (dragging) return; // a second finger or button while one is already turning the mesh
    activeId = (event as PointerEvent).pointerId;
    dragging = true;
    target.setDragging?.(true);
    lastX = event.clientX;
    lastY = event.clientY;
    (element as Partial<HTMLElement>).setPointerCapture?.((event as PointerEvent).pointerId);
  };
  const onMove = (event: MouseEvent): void => {
    if (!dragging || (event as PointerEvent).pointerId !== activeId) return;
    if (event.buttons === 0) {
      end();
      return;
    }
    const dx = event.clientX - lastX;
    const dy = event.clientY - lastY;
    lastX = event.clientX;
    lastY = event.clientY;
    if (dx !== 0 || dy !== 0) target.turn(dx, dy, Math.min(element.clientWidth, element.clientHeight));
  };
  const onWheel = (event: WheelEvent): void => {
    if (filter()?.ignoresWheel?.(event)) return;
    event.preventDefault();
    const units = event.deltaMode === 1 ? event.deltaY * LINE_UNITS : event.deltaY; // a notch is 100 units; a trackpad sends many small ones
    if (units === 0) return;
    if (Math.sign(units) !== Math.sign(wheelRemainder)) wheelRemainder = 0;
    wheelRemainder += units;
    while (Math.abs(wheelRemainder) >= WHEEL_NOTCH) {
      const direction = Math.sign(wheelRemainder);
      target.dolly(direction);
      wheelRemainder -= direction * WHEEL_NOTCH;
    }
  };
  const onContextMenu = (event: Event): void => event.preventDefault();

  element.addEventListener('pointerdown', onDown as EventListener);
  element.style.touchAction = 'none'; // one finger drags the mesh instead of scrolling the page
  window.addEventListener('pointermove', onMove as EventListener); // moves over the canvas bubble here too, so one listener sees them all
  window.addEventListener('pointerup', end);
  window.addEventListener('pointercancel', end);
  element.addEventListener('lostpointercapture', end);
  element.addEventListener('wheel', onWheel as EventListener, { passive: false });
  element.addEventListener('contextmenu', onContextMenu);
  return () => {
    end();
    element.removeEventListener('pointerdown', onDown as EventListener);
    window.removeEventListener('pointermove', onMove as EventListener);
    window.removeEventListener('pointerup', end);
    window.removeEventListener('pointercancel', end);
    element.removeEventListener('lostpointercapture', end);
    element.removeEventListener('wheel', onWheel as EventListener);
    element.removeEventListener('contextmenu', onContextMenu);
  };
}
