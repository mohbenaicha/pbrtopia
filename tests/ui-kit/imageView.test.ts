import { describe, expect, it } from 'vitest';
import { FITTED_IMAGE_VIEW, fitImage, panImageBy, zoomImageAt } from '../../src/ui-kit/imageView';

const SQUARE = { width: 100, height: 100 };

describe('imageView', () => {
  it('viewport-layout R33 fitImage fits the picture inside the frame, keeping its shape, and scales a small one up', () => {
    expect(fitImage({ width: 200, height: 100 }, SQUARE)).toEqual({ width: 100, height: 50 });
    expect(fitImage({ width: 50, height: 200 }, SQUARE)).toEqual({ width: 25, height: 100 });
    expect(fitImage({ width: 10, height: 10 }, { width: 400, height: 300 })).toEqual({ width: 300, height: 300 });
  });

  it('viewport-layout R33 fitImage of a picture with no size yet is empty', () => {
    expect(fitImage({ width: 0, height: 0 }, SQUARE)).toEqual({ width: 0, height: 0 });
  });

  it('viewport-layout R33 a wheel turn away from the screen zooms in and the point under the pointer stays under it', () => {
    const pointer = { x: 25, y: -10 }; // from the frame centre
    const view = zoomImageAt(FITTED_IMAGE_VIEW, -100, 0, pointer, SQUARE, SQUARE);
    expect(view.zoom).toBeGreaterThan(1);
    expect((pointer.x - view.x) / view.zoom).toBeCloseTo(pointer.x, 6);
    expect((pointer.y - view.y) / view.zoom).toBeCloseTo(pointer.y, 6);
  });

  it('viewport-layout R33 the zoom never goes below the fitted size or above 16x, and nothing changes at the limit', () => {
    expect(zoomImageAt(FITTED_IMAGE_VIEW, 500, 0, { x: 0, y: 0 }, SQUARE, SQUARE)).toBe(FITTED_IMAGE_VIEW);
    let view = FITTED_IMAGE_VIEW;
    for (let turn = 0; turn < 60; turn += 1) view = zoomImageAt(view, -300, 0, { x: 0, y: 0 }, SQUARE, SQUARE);
    expect(view.zoom).toBe(16);
  });

  it('viewport-layout R33 a wheel that counts lines zooms as much as 16 pixels per line', () => {
    const byPixels = zoomImageAt(FITTED_IMAGE_VIEW, -48, 0, { x: 0, y: 0 }, SQUARE, SQUARE);
    const byLines = zoomImageAt(FITTED_IMAGE_VIEW, -3, 1, { x: 0, y: 0 }, SQUARE, SQUARE);
    expect(byLines.zoom).toBeCloseTo(byPixels.zoom, 9);
  });

  it('viewport-layout R33 a zoomed picture cannot be dragged off the frame, and a fitted one cannot be dragged at all', () => {
    const zoomed = { zoom: 2, x: 0, y: 0 };
    expect(panImageBy(zoomed, 1000, -1000, SQUARE, SQUARE)).toEqual({ zoom: 2, x: 50, y: -50 });
    expect(panImageBy(FITTED_IMAGE_VIEW, 30, 30, SQUARE, SQUARE)).toEqual(FITTED_IMAGE_VIEW);
  });

  it('viewport-layout R33 a wide picture can be dragged along its long side only until it is zoomed past the frame on the short side', () => {
    const wide = { width: 200, height: 100 }; // fits as 100 x 50 in a 100 x 100 frame
    const zoomed = { zoom: 3, x: 0, y: 0 }; // 300 x 150: wider than the frame by 200, taller by 50
    expect(panImageBy(zoomed, 1000, 1000, wide, SQUARE)).toEqual({ zoom: 3, x: 100, y: 25 });
    const barely = { zoom: 1.5, x: 0, y: 0 }; // 150 x 75: the short side still fits the frame
    expect(panImageBy(barely, 1000, 1000, wide, SQUARE)).toEqual({ zoom: 1.5, x: 25, y: 0 });
  });

  it('viewport-layout R33 zooming back out to the fitted size centres the picture again', () => {
    let view = zoomImageAt(FITTED_IMAGE_VIEW, -300, 0, { x: 40, y: 40 }, SQUARE, SQUARE);
    view = panImageBy(view, -20, -20, SQUARE, SQUARE);
    for (let turn = 0; turn < 20; turn += 1) view = zoomImageAt(view, 300, 0, { x: 40, y: 40 }, SQUARE, SQUARE);
    expect(view).toEqual(FITTED_IMAGE_VIEW);
  });
});
