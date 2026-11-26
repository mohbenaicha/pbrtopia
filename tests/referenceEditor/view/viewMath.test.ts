import { describe, expect, it } from 'vitest';
import { keyActionOf } from '../../../src/referenceEditor/view/keymap';
import { MAX_SCALE, MIN_SCALE, fitTransform, panBy, toImagePoint, wheelFactor, zoomAround } from '../../../src/referenceEditor/view/viewMath';

describe('view math (reference-editor R5)', () => {
  it('R5 fit centres the whole picture in the stage', () => {
    const view = fitTransform({ w: 800, h: 600 }, { w: 400, h: 100 });
    expect(view.scale).toBeCloseTo((800 - 32) / 400);
    expect(view.x + 200 * view.scale).toBeCloseTo(400);
    expect(view.y + 50 * view.scale).toBeCloseTo(300);
  });

  it('R5 zooming around the pointer keeps the image point under it fixed', () => {
    const view = { scale: 1.5, x: 40, y: -20 };
    const at = { x: 300, y: 200 };
    const before = toImagePoint(view, at);
    const after = toImagePoint(zoomAround(view, at, 1.7), at);
    expect(after.x).toBeCloseTo(before.x);
    expect(after.y).toBeCloseTo(before.y);
  });

  it('R5 zoom is clamped between 5 % and 3200 % and a clamped zoom still keeps the point fixed', () => {
    let view = { scale: 1, x: 0, y: 0 };
    for (let k = 0; k < 40; k += 1) view = zoomAround(view, { x: 10, y: 10 }, 2);
    expect(view.scale).toBe(MAX_SCALE);
    expect(MAX_SCALE).toBe(32);
    for (let k = 0; k < 40; k += 1) view = zoomAround(view, { x: 10, y: 10 }, 0.5);
    expect(view.scale).toBe(MIN_SCALE);
    expect(MIN_SCALE).toBe(0.05);
    expect(toImagePoint(view, { x: 10, y: 10 }).x).toBeCloseTo(toImagePoint(zoomAround(view, { x: 10, y: 10 }, 0.5), { x: 10, y: 10 }).x);
  });

  it('R5 panning moves the picture and leaves the scale', () => {
    expect(panBy({ scale: 2, x: 5, y: 6 }, 10, -4)).toEqual({ scale: 2, x: 15, y: 2 });
  });

  it('R5 a wheel notch zooms in when scrolled up and out when scrolled down', () => {
    expect(wheelFactor(-100)).toBeGreaterThan(1);
    expect(wheelFactor(100)).toBeLessThan(1);
    expect(wheelFactor(-100) * wheelFactor(100)).toBeCloseTo(1);
  });
});

describe('keymap (reference-editor R6, R14, R20)', () => {
  const key = (k: string, mods: Partial<{ ctrlKey: boolean; metaKey: boolean; shiftKey: boolean }> = {}) => keyActionOf({ key: k, ctrlKey: false, metaKey: false, shiftKey: false, ...mods });

  it('R14 Ctrl+Z undoes, Ctrl+Shift+Z and Ctrl+Y redo, and Cmd works like Ctrl', () => {
    expect(key('z', { ctrlKey: true })).toBe('undo');
    expect(key('Z', { ctrlKey: true, shiftKey: true })).toBe('redo');
    expect(key('y', { ctrlKey: true })).toBe('redo');
    expect(key('z', { metaKey: true })).toBe('undo');
  });

  it('R6 the bracket keys change the brush size', () => {
    expect(key('[')).toBe('brushSmaller');
    expect(key(']')).toBe('brushLarger');
  });

  it('R10 Escape and R5 the arrow keys have actions; other keys and other shortcuts have none', () => {
    expect(key('Escape')).toBe('escape');
    expect(key('ArrowLeft')).toBe('panLeft');
    expect(key('a')).toBeNull();
    expect(key('s', { ctrlKey: true })).toBeNull();
  });
});
