import { BRUSH_CONTROLS, type BrushParams } from './brushParams';

/** Compositing R73: the sideways movement, in pixels, that sweeps Size across its whole range. */
export const SIZE_DRAG_PIXELS = 600;

/** Compositing R73: the resize gesture is Alt held with no Shift (the straight line, R13) and no Ctrl (Undo) and no button down. */
export function isResizeGesture(event: { altKey: boolean; ctrlKey: boolean; shiftKey: boolean; buttons: number }): boolean {
  return event.altKey && !event.ctrlKey && !event.shiftKey && event.buttons === 0;
}

/**
 * Compositing R73: the brush after the pointer moved `dx` pixels sideways with Alt held. Right grows Size, left shrinks it, clamped to its range. With the dice on the
 * range moves as a whole and keeps its width, stopping when an end meets a limit; the single value is kept. A movement that changes nothing returns `brush` itself.
 */
export function resizeByPointer(brush: BrushParams, dx: number): BrushParams {
  const { min, max } = BRUSH_CONTROLS.size;
  const wanted = ((max - min) * dx) / SIZE_DRAG_PIXELS;
  if (!Number.isFinite(wanted) || wanted === 0) return brush;
  const { size } = brush;
  if (size.random) {
    const width = size.high - size.low;
    let { low, high } = size;
    if (wanted <= min - low) [low, high] = [min, min + width]; // an end lands exactly on its limit, the width kept
    else if (wanted >= max - high) [low, high] = [max - width, max];
    else [low, high] = [low + wanted, high + wanted];
    return low === size.low && high === size.high ? brush : { ...brush, size: { ...size, low, high } };
  }
  const value = Math.min(Math.max(size.value + wanted, min), max);
  return value === size.value ? brush : { ...brush, size: { ...size, value } };
}
