// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { PanelGutter } from '../../src/shell/PanelGutter';

afterEach(cleanup);

function setup(side: 'left' | 'right' = 'left') {
  const onResize = vi.fn();
  const onCommit = vi.fn();
  const onReset = vi.fn();
  render(<PanelGutter side={side} widthPx={300} limits={{ min: 220, max: 520 }} onResize={onResize} onCommit={onCommit} onReset={onReset} />);
  return { gutter: screen.getByRole('separator'), onResize, onCommit, onReset };
}

describe('PanelGutter', () => {
  it('viewport-layout R25 it is a focusable vertical separator that states the width and its limits', () => {
    const { gutter } = setup('left');
    expect(gutter.getAttribute('aria-label')).toBe('Resize left panel');
    expect(gutter.getAttribute('aria-orientation')).toBe('vertical');
    expect(gutter.getAttribute('aria-valuenow')).toBe('300');
    expect(gutter.getAttribute('aria-valuemin')).toBe('220');
    expect(gutter.getAttribute('aria-valuemax')).toBe('520');
    expect(gutter.tabIndex).toBe(0);
  });

  it('viewport-layout R25 on the left gutter the right arrow grows the panel by 16 px and the left arrow shrinks it, each saved', () => {
    const { gutter, onResize, onCommit } = setup('left');
    fireEvent.keyDown(gutter, { key: 'ArrowRight' });
    expect(onResize).toHaveBeenLastCalledWith(316);
    fireEvent.keyDown(gutter, { key: 'ArrowLeft' });
    expect(onResize).toHaveBeenLastCalledWith(284);
    expect(onCommit).toHaveBeenCalledTimes(2);
  });

  it('viewport-layout R25 on the right gutter the left arrow grows the panel and the right arrow shrinks it', () => {
    const { gutter, onResize } = setup('right');
    expect(gutter.getAttribute('aria-label')).toBe('Resize right panel');
    fireEvent.keyDown(gutter, { key: 'ArrowLeft' });
    expect(onResize).toHaveBeenLastCalledWith(316);
    fireEvent.keyDown(gutter, { key: 'ArrowRight' });
    expect(onResize).toHaveBeenLastCalledWith(284);
  });

  it('viewport-layout R25 other keys do nothing', () => {
    const { gutter, onResize, onCommit } = setup();
    fireEvent.keyDown(gutter, { key: 'ArrowUp' });
    fireEvent.keyDown(gutter, { key: 'a' });
    expect(onResize).not.toHaveBeenCalled();
    expect(onCommit).not.toHaveBeenCalled();
  });

  it('viewport-layout R25 dragging the left gutter right widens the panel as the pointer moves and is saved once on release', () => {
    const { gutter, onResize, onCommit } = setup('left');
    fireEvent.pointerDown(gutter, { clientX: 300, pointerId: 1, button: 0 });
    fireEvent.pointerMove(gutter, { clientX: 340, pointerId: 1 });
    expect(onResize).toHaveBeenLastCalledWith(340);
    fireEvent.pointerMove(gutter, { clientX: 280, pointerId: 1 });
    expect(onResize).toHaveBeenLastCalledWith(280);
    expect(onCommit).not.toHaveBeenCalled();
    fireEvent.pointerUp(gutter, { clientX: 280, pointerId: 1 });
    expect(onCommit).toHaveBeenCalledTimes(1);
  });

  it('viewport-layout R25 dragging the right gutter left widens the right panel', () => {
    const { gutter, onResize } = setup('right');
    fireEvent.pointerDown(gutter, { clientX: 900, pointerId: 1, button: 0 });
    fireEvent.pointerMove(gutter, { clientX: 850, pointerId: 1 });
    expect(onResize).toHaveBeenLastCalledWith(350);
  });

  it('viewport-layout R25 moving the pointer without pressing, or after release, resizes nothing', () => {
    const { gutter, onResize } = setup('left');
    fireEvent.pointerMove(gutter, { clientX: 400, pointerId: 1 });
    fireEvent.pointerDown(gutter, { clientX: 300, pointerId: 1, button: 0 });
    fireEvent.pointerUp(gutter, { clientX: 300, pointerId: 1 });
    fireEvent.pointerMove(gutter, { clientX: 500, pointerId: 1 });
    expect(onResize).not.toHaveBeenCalled();
  });

  it('viewport-layout R25 a double click restores the default width', () => {
    const { gutter, onReset } = setup();
    fireEvent.doubleClick(gutter);
    expect(onReset).toHaveBeenCalledTimes(1);
  });
});
