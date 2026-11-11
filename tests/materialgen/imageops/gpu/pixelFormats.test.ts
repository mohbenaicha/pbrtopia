import { describe, expect, it } from 'vitest';
import { fromRgba, toRgba } from '../../../../src/materialgen/imageops/gpu/pixelFormats';

describe('imageops pixel formats (R5)', () => {
  it('R5 a grey image becomes opaque RGBA with the grey in all three colour channels', () => {
    const rgba = toRgba({ width: 2, height: 1, channels: 1, data: new Uint8Array([10, 200]) });
    expect([...rgba]).toEqual([10, 10, 10, 255, 200, 200, 200, 255]);
  });

  it('R5 an RGB image gains an opaque alpha and an RGBA image is kept', () => {
    expect([...toRgba({ width: 1, height: 1, channels: 3, data: new Uint8Array([1, 2, 3]) })]).toEqual([1, 2, 3, 255]);
    const four = new Uint8Array([1, 2, 3, 4]);
    expect(toRgba({ width: 1, height: 1, channels: 4, data: four })).toBe(four);
  });

  it('R5 grey is written back from the red channel; RGB drops the alpha', () => {
    const rgba = new Uint8Array([10, 99, 99, 255, 200, 1, 2, 255]);
    expect(fromRgba(rgba, 2, 1, 1)).toEqual({ width: 2, height: 1, channels: 1, data: new Uint8Array([10, 200]) });
    expect(fromRgba(rgba, 2, 1, 3)).toEqual({ width: 2, height: 1, channels: 3, data: new Uint8Array([10, 99, 99, 200, 1, 2]) });
  });

  it('R23 grey data survives the round trip', () => {
    const grey = { width: 3, height: 1, channels: 1 as const, data: new Uint8Array([0, 128, 255]) };
    expect(fromRgba(toRgba(grey), 3, 1, 1)).toEqual(grey);
  });
});
