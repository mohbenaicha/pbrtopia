// @vitest-environment jsdom
import { describe, expect, it, vi } from 'vitest';
import { watchContextLoss } from '../../src/viewport/contextLoss';

describe('contextLoss', () => {
  it('R18 a lost context is reported and its default is prevented so the browser may restore it', () => {
    const canvas = document.createElement('canvas');
    const onLost = vi.fn();
    watchContextLoss(canvas, { onLost, onRestored: () => undefined });
    const event = new Event('webglcontextlost', { cancelable: true });
    canvas.dispatchEvent(event);
    expect(onLost).toHaveBeenCalledTimes(1);
    expect(event.defaultPrevented).toBe(true);
  });

  it('R18 a restored context is reported', () => {
    const canvas = document.createElement('canvas');
    const onRestored = vi.fn();
    watchContextLoss(canvas, { onLost: () => undefined, onRestored });
    canvas.dispatchEvent(new Event('webglcontextrestored'));
    expect(onRestored).toHaveBeenCalledTimes(1);
  });

  it('R18 after stopping, neither event is reported', () => {
    const canvas = document.createElement('canvas');
    const onLost = vi.fn();
    const onRestored = vi.fn();
    const stop = watchContextLoss(canvas, { onLost, onRestored });
    stop();
    canvas.dispatchEvent(new Event('webglcontextlost', { cancelable: true }));
    canvas.dispatchEvent(new Event('webglcontextrestored'));
    expect(onLost).not.toHaveBeenCalled();
    expect(onRestored).not.toHaveBeenCalled();
  });
});
