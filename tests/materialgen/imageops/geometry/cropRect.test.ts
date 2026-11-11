import { describe, expect, it } from 'vitest';
import { describeCrop, fullRect, isFullRect, trimEdge, MIN_CROP_SIDE } from '../../../../src/materialgen/imageops/geometry/cropRect';

describe('imageops crop rectangle (R29)', () => {
  it('R29 starts as the whole working copy, which is not a change', () => {
    const rect = fullRect(2048);
    expect(rect).toEqual({ x: 0, y: 0, width: 2048, height: 2048 });
    expect(isFullRect(rect, 2048)).toBe(true);
  });

  it('R29 each edge button removes the amount from that edge only', () => {
    const start = fullRect(512);
    expect(trimEdge(start, 'top', 8)).toEqual({ x: 0, y: 8, width: 512, height: 504 });
    expect(trimEdge(start, 'left', 8)).toEqual({ x: 8, y: 0, width: 504, height: 512 });
    expect(trimEdge(start, 'right', 8)).toEqual({ x: 0, y: 0, width: 504, height: 512 });
    expect(trimEdge(start, 'bottom', 8)).toEqual({ x: 0, y: 0, width: 512, height: 504 });
  });

  it('R29 clicks add up, and the rectangle is no longer full', () => {
    const rect = trimEdge(trimEdge(fullRect(512), 'top', 8), 'top', 8);
    expect(rect).toEqual({ x: 0, y: 16, width: 512, height: 496 });
    expect(isFullRect(rect, 512)).toBe(false);
  });

  it('R29 the amount is at least 1 pixel and whole', () => {
    expect(trimEdge(fullRect(512), 'left', 0).width).toBe(511);
    expect(trimEdge(fullRect(512), 'left', 2.7).width).toBe(510);
    expect(trimEdge(fullRect(512), 'left', Number.NaN).width).toBe(511);
  });

  it('R29 a click that would leave fewer than 16 pixels on an axis is ignored', () => {
    const near = { x: 0, y: 0, width: 512, height: MIN_CROP_SIDE + 4 };
    expect(trimEdge(near, 'top', 8)).toBe(near);
    expect(trimEdge(near, 'top', 4).height).toBe(MIN_CROP_SIDE);
    expect(trimEdge(near, 'left', 8).width).toBe(504); // the other axis is unaffected
  });

  it('R29 the panel text names the rectangle and the size it is scaled to', () => {
    expect(describeCrop({ x: 64, y: 0, width: 1920, height: 1984 }, 2048)).toBe('1920 x 1984 px, scaled to 2048 x 2048');
  });
});
