import { describe, expect, it } from 'vitest';
import { computeCoverCrop, DEFAULT_THUMBNAIL_SPEC } from '../../src/viewport/captureThumbnail';

describe('thumbnail crop', () => {
  it('R17 the default thumbnail is a 320x240 JPEG at quality 0.8', () => {
    expect(DEFAULT_THUMBNAIL_SPEC).toEqual({ width: 320, height: 240, mime: 'image/jpeg', quality: 0.8 });
  });

  it('R17 a wider view loses its sides equally and keeps the full height', () => {
    expect(computeCoverCrop(1600, 600, 320, 240)).toEqual({ sx: 400, sy: 0, sw: 800, sh: 600 });
  });

  it('R17 a taller view loses its top and bottom equally and keeps the full width', () => {
    expect(computeCoverCrop(600, 1200, 320, 240)).toEqual({ sx: 0, sy: 375, sw: 600, sh: 450 });
  });

  it('R17 a view with the same shape is used whole', () => {
    expect(computeCoverCrop(800, 600, 320, 240)).toEqual({ sx: 0, sy: 0, sw: 800, sh: 600 });
  });
});
