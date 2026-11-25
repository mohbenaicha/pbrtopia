import { describe, expect, it } from 'vitest';
import { isGreyHeight } from '../../../../src/generation/normal/height/isGreyHeight';
import type { PixelPicture } from '../../../../src/generation/normal/uprightTypes';

const grey = (side: number): PixelPicture => {
  const rgba = new Uint8ClampedArray(side * side * 4);
  for (let i = 0; i < side * side; i += 1) rgba.set([i % 256, i % 256, i % 256, 255], i * 4);
  return { side, rgba };
};

describe('isGreyHeight', () => {
  it('normal-height-edit R14 a grey picture of the asked side is a height base', () => {
    expect(isGreyHeight(grey(8), 8)).toBe(true);
  });

  it('normal-height-edit R14 a picture of another side is refused', () => {
    expect(isGreyHeight(grey(8), 16)).toBe(false);
  });

  it('normal-height-edit R14 one texel that is not grey, or not opaque, is refused', () => {
    const coloured = grey(8);
    coloured.rgba[5 * 4 + 1] = 7;
    expect(isGreyHeight(coloured, 8)).toBe(false);
    const clear = grey(8);
    clear.rgba[9 * 4 + 3] = 128;
    expect(isGreyHeight(clear, 8)).toBe(false);
  });
});
