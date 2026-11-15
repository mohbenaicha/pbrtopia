import { describe, expect, it } from 'vitest';
import { BRUSH_CONTROLS, DEFAULT_BRUSH } from '../../../../src/materialgen/compositing/plan/brushParams';
import { SIZE_DRAG_PIXELS, isResizeGesture, resizeByPointer } from '../../../../src/materialgen/compositing/plan/resizeByPointer';

const { min, max } = BRUSH_CONTROLS.size;
const span = max - min;

describe('materialgen/compositing Alt + move changes Size (R73)', () => {
  it('R73 only Alt with no Shift and no button down is the resize gesture; Shift stays for the straight line and Ctrl for Undo', () => {
    const press = (patch: Partial<{ altKey: boolean; ctrlKey: boolean; shiftKey: boolean; buttons: number }>) => ({ altKey: false, ctrlKey: false, shiftKey: false, buttons: 0, ...patch });
    expect(isResizeGesture(press({ altKey: true }))).toBe(true);
    expect(isResizeGesture(press({ shiftKey: true }))).toBe(false);
    expect(isResizeGesture(press({ ctrlKey: true }))).toBe(false);
    expect(isResizeGesture(press({}))).toBe(false);
    expect(isResizeGesture(press({ altKey: true, shiftKey: true }))).toBe(false);
    expect(isResizeGesture(press({ altKey: true, ctrlKey: true }))).toBe(false);
    expect(isResizeGesture(press({ altKey: true, buttons: 1 }))).toBe(false);
  });

  it('R73 the whole range is covered by 600 px of movement', () => {
    expect(SIZE_DRAG_PIXELS).toBe(600);
  });

  it('R73 moving right grows Size and moving left shrinks it, in proportion to the distance', () => {
    const grown = resizeByPointer(DEFAULT_BRUSH, 60);
    expect(grown.size.value).toBeCloseTo(DEFAULT_BRUSH.size.value + span * 0.1, 10);
    const shrunk = resizeByPointer(DEFAULT_BRUSH, -3);
    expect(shrunk.size.value).toBeCloseTo(DEFAULT_BRUSH.size.value - span * 0.005, 10);
  });

  it('R73 Size stays inside its range at both ends', () => {
    expect(resizeByPointer(DEFAULT_BRUSH, 5000).size.value).toBe(max);
    expect(resizeByPointer(DEFAULT_BRUSH, -5000).size.value).toBe(min);
  });

  it('R73 a movement with no sideways part returns the same brush', () => {
    expect(resizeByPointer(DEFAULT_BRUSH, 0)).toBe(DEFAULT_BRUSH);
    expect(resizeByPointer(DEFAULT_BRUSH, Number.NaN)).toBe(DEFAULT_BRUSH);
  });

  it('R73 a movement that cannot change Size (already at the limit) returns the same brush', () => {
    const atMax = { ...DEFAULT_BRUSH, size: { ...DEFAULT_BRUSH.size, value: max } };
    expect(resizeByPointer(atMax, 30)).toBe(atMax);
  });

  it('R73 only Size changes; the other controls are the same objects', () => {
    const next = resizeByPointer(DEFAULT_BRUSH, 30);
    expect(next.rotation).toBe(DEFAULT_BRUSH.rotation);
    expect(next.strength).toBe(DEFAULT_BRUSH.strength);
    expect(next.height).toBe(DEFAULT_BRUSH.height);
  });

  it('R73 with the dice on the range moves whole and keeps its width, and the single value is kept', () => {
    const ranged = { ...DEFAULT_BRUSH, size: { value: 0.3, random: true, low: 0.2, high: 0.4 } };
    const next = resizeByPointer(ranged, 60);
    expect(next.size.low).toBeCloseTo(0.2 + span * 0.1, 10);
    expect(next.size.high).toBeCloseTo(0.4 + span * 0.1, 10);
    expect(next.size.value).toBe(0.3);
    expect(next.size.random).toBe(true);
  });

  it('R73 with the dice on the range stops with its width kept when one end meets a limit', () => {
    const ranged = { ...DEFAULT_BRUSH, size: { value: 0.3, random: true, low: 0.7, high: 0.9 } };
    const up = resizeByPointer(ranged, 5000);
    expect(up.size.high).toBe(max);
    expect(up.size.high - up.size.low).toBeCloseTo(0.2, 10);
    const down = resizeByPointer(ranged, -5000);
    expect(down.size.low).toBe(min);
    expect(down.size.high - down.size.low).toBeCloseTo(0.2, 10);
  });
});
