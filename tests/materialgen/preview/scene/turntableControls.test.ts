// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { attachTurntableControls, type TurntableTarget } from '../../../../src/materialgen/preview/scene/attachTurntableControls';

function setup() {
  const element = document.createElement('div');
  Object.defineProperty(element, 'clientWidth', { value: 600 });
  Object.defineProperty(element, 'clientHeight', { value: 400 });
  document.body.appendChild(element);
  const target: TurntableTarget = { turn: vi.fn(), dolly: vi.fn() };
  const detach = attachTurntableControls(element, target);
  return { element, target, detach };
}
const pointer = (type: string, init: { x?: number; y?: number; button?: number; buttons?: number } = {}) =>
  new MouseEvent(type, { clientX: init.x ?? 0, clientY: init.y ?? 0, button: init.button ?? 0, buttons: init.buttons ?? 0, bubbles: true, cancelable: true });
afterEach(() => (document.body.innerHTML = ''));

describe('materialgen/preview R20 R21 R22 pointer and wheel', () => {
  it('R20 a left-button drag turns by the pointer movement, relative to the smaller side', () => {
    const { element, target } = setup();
    element.dispatchEvent(pointer('pointerdown', { x: 100, y: 100, buttons: 1 }));
    element.dispatchEvent(pointer('pointermove', { x: 130, y: 90, buttons: 1 }));
    expect(target.turn).toHaveBeenCalledWith(30, -10, 400);
  });

  it('R20 the right button turns as well', () => {
    const { element, target } = setup();
    element.dispatchEvent(pointer('pointerdown', { x: 0, y: 0, button: 2, buttons: 2 }));
    element.dispatchEvent(pointer('pointermove', { x: 5, y: 0, buttons: 2 }));
    expect(target.turn).toHaveBeenCalledWith(5, 0, 400);
  });

  it('R21 the middle button does nothing: no turn and the browser does not start auto-scroll', () => {
    const { element, target } = setup();
    const down = pointer('pointerdown', { button: 1, buttons: 4 });
    element.dispatchEvent(down);
    element.dispatchEvent(pointer('pointermove', { x: 50, y: 50, buttons: 4 }));
    expect(target.turn).not.toHaveBeenCalled();
    expect(down.defaultPrevented).toBe(true);
  });

  it('R20 a click without movement turns nothing', () => {
    const { element, target } = setup();
    element.dispatchEvent(pointer('pointerdown', { x: 10, y: 10, buttons: 1 }));
    element.dispatchEvent(pointer('pointerup', { x: 10, y: 10 }));
    expect(target.turn).not.toHaveBeenCalled();
  });

  it('R20 after the release, even outside the canvas, a returning pointer does not keep turning the mesh', () => {
    const { element, target } = setup();
    element.dispatchEvent(pointer('pointerdown', { x: 0, y: 0, buttons: 1 }));
    window.dispatchEvent(pointer('pointerup', { x: -500, y: 40 }));
    element.dispatchEvent(pointer('pointermove', { x: 20, y: 20, buttons: 0 }));
    window.dispatchEvent(pointer('pointermove', { x: 30, y: 30, buttons: 0 }));
    expect(target.turn).not.toHaveBeenCalled();
  });

  it('R20 a move that reports no button held ends the drag (the release happened where no event reached us)', () => {
    const { element, target } = setup();
    element.dispatchEvent(pointer('pointerdown', { x: 0, y: 0, buttons: 1 }));
    window.dispatchEvent(pointer('pointermove', { x: 10, y: 0, buttons: 0 }));
    window.dispatchEvent(pointer('pointermove', { x: 20, y: 0, buttons: 1 }));
    expect(target.turn).not.toHaveBeenCalled();
  });

  it('R22 the wheel dollies by direction and stops the page from scrolling', () => {
    const { element, target } = setup();
    const down = new WheelEvent('wheel', { deltaY: 100, bubbles: true, cancelable: true });
    element.dispatchEvent(down);
    element.dispatchEvent(new WheelEvent('wheel', { deltaY: -100, bubbles: true, cancelable: true }));
    expect(target.dolly).toHaveBeenNthCalledWith(1, 1);
    expect(target.dolly).toHaveBeenNthCalledWith(2, -1);
    expect(down.defaultPrevented).toBe(true);
  });

  it('R22 a trackpad fling of many small wheel events dollies one step per 100 units, not one per event', () => {
    const { element, target } = setup();
    for (let i = 0; i < 25; i += 1) element.dispatchEvent(new WheelEvent('wheel', { deltaY: 10, bubbles: true, cancelable: true }));
    expect(target.dolly).toHaveBeenCalledTimes(2);
    expect(target.dolly).toHaveBeenCalledWith(1);
  });

  it('R22 a wheel that changes direction does not carry the earlier remainder over', () => {
    const { element, target } = setup();
    element.dispatchEvent(new WheelEvent('wheel', { deltaY: 60, bubbles: true, cancelable: true }));
    element.dispatchEvent(new WheelEvent('wheel', { deltaY: -100, bubbles: true, cancelable: true }));
    expect(target.dolly).toHaveBeenCalledTimes(1);
    expect(target.dolly).toHaveBeenCalledWith(-1);
  });

  it('R20 a second finger does not take over the drag: only the pointer that started it turns the mesh', () => {
    const { element, target } = setup();
    const touch = (type: string, id: number, x: number) => Object.assign(pointer(type, { x, y: 0, buttons: 1 }), { pointerId: id });
    element.dispatchEvent(touch('pointerdown', 1, 100));
    element.dispatchEvent(touch('pointerdown', 2, 300));
    element.dispatchEvent(touch('pointermove', 2, 320));
    expect(target.turn).not.toHaveBeenCalled();
    element.dispatchEvent(touch('pointermove', 1, 110));
    expect(target.turn).toHaveBeenCalledWith(10, 0, 400);
  });

  it('R20 lifting the second finger leaves the first finger dragging', () => {
    const { element, target } = setup();
    const touch = (type: string, id: number, x: number) => Object.assign(pointer(type, { x, y: 0, buttons: 1 }), { pointerId: id });
    element.dispatchEvent(touch('pointerdown', 1, 100));
    element.dispatchEvent(touch('pointerdown', 2, 300));
    window.dispatchEvent(touch('pointerup', 2, 300));
    element.dispatchEvent(touch('pointermove', 1, 105));
    expect(target.turn).toHaveBeenCalledWith(5, 0, 400);
  });

  it('R20 the context menu is suppressed so the right button can drag', () => {
    const { element } = setup();
    const menu = new MouseEvent('contextmenu', { bubbles: true, cancelable: true });
    element.dispatchEvent(menu);
    expect(menu.defaultPrevented).toBe(true);
  });

  it('R6 detaching removes every listener', () => {
    const { element, target, detach } = setup();
    detach();
    element.dispatchEvent(pointer('pointerdown', { buttons: 1 }));
    element.dispatchEvent(pointer('pointermove', { x: 40, buttons: 1 }));
    element.dispatchEvent(new WheelEvent('wheel', { deltaY: 100 }));
    expect(target.turn).not.toHaveBeenCalled();
    expect(target.dolly).not.toHaveBeenCalled();
  });
});

describe('materialgen/preview R53 drag state', () => {
  const withDragReport = () => {
    const element = document.createElement('div');
    document.body.appendChild(element);
    const setDragging = vi.fn();
    const detach = attachTurntableControls(element, { turn: vi.fn(), dolly: vi.fn(), setDragging });
    return { element, setDragging, detach };
  };

  it('R53 reports a drag start on press and its end on release', () => {
    const { element, setDragging } = withDragReport();
    element.dispatchEvent(pointer('pointerdown', { buttons: 1 }));
    expect(setDragging).toHaveBeenLastCalledWith(true);
    window.dispatchEvent(pointer('pointerup'));
    expect(setDragging).toHaveBeenLastCalledWith(false);
  });

  it('R53 detaching while a drag runs reports its end', () => {
    const { element, setDragging, detach } = withDragReport();
    element.dispatchEvent(pointer('pointerdown', { buttons: 1 }));
    detach();
    expect(setDragging).toHaveBeenLastCalledWith(false);
  });

  it('R53 the middle button starts no drag', () => {
    const { element, setDragging } = withDragReport();
    element.dispatchEvent(pointer('pointerdown', { button: 1, buttons: 4 }));
    expect(setDragging).not.toHaveBeenCalled();
  });
});
