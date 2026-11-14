import { describe, expect, it } from 'vitest';
import { greyFromImage, imageFromGrey, imageFromRgba, ormFromMaps, rgbaFromImage, splitOrm } from '../../../../src/materialgen/compositing/session/pictureBytes';

const image = (channels: 1 | 3 | 4, data: number[]) => ({ width: 2, height: 1, channels, data: Uint8Array.from(data) });

describe('materialgen/compositing picture bytes (R20 R22)', () => {
  it('R20 any stored channel count becomes opaque RGBA bytes', () => {
    expect(Array.from(rgbaFromImage(image(4, [1, 2, 3, 4, 5, 6, 7, 8])))).toEqual([1, 2, 3, 4, 5, 6, 7, 8]);
    expect(Array.from(rgbaFromImage(image(3, [1, 2, 3, 4, 5, 6])))).toEqual([1, 2, 3, 255, 4, 5, 6, 255]);
    expect(Array.from(rgbaFromImage(image(1, [9, 10])))).toEqual([9, 9, 9, 255, 10, 10, 10, 255]);
  });

  it('R20 a grey map reads its first channel', () => {
    expect(Array.from(greyFromImage(image(1, [7, 8])))).toEqual([7, 8]);
    expect(Array.from(greyFromImage(image(3, [7, 0, 0, 8, 0, 0])))).toEqual([7, 8]);
  });

  it('R17 R20 the packed texture takes AO, roughness and metal, with the flat defaults for a missing map', () => {
    const packed = ormFromMaps({ ao: image(1, [10, 20]), rough: image(1, [30, 40]), metal: image(1, [50, 60]) }, 2, 1);
    expect(Array.from(packed)).toEqual([10, 30, 50, 255, 20, 40, 60, 255]);
    expect(Array.from(ormFromMaps({}, 2, 1))).toEqual([255, 128, 0, 255, 255, 128, 0, 255]);
  });

  it('R22 splitting the packed bytes gives roughness from G and metal from B as grey pictures', () => {
    const { rough, metal } = splitOrm(Uint8Array.from([10, 30, 50, 255, 20, 40, 60, 255]), 2, 1);
    expect([rough.channels, rough.width, rough.height, Array.from(rough.data)]).toEqual([1, 2, 1, [30, 40]]);
    expect(Array.from(metal.data)).toEqual([50, 60]);
  });

  it('R22 pictures are rebuilt in the channel count asked', () => {
    const rgba = Uint8Array.from([1, 2, 3, 255, 4, 5, 6, 255]);
    expect(Array.from(imageFromRgba(rgba, 2, 1, 3).data)).toEqual([1, 2, 3, 4, 5, 6]);
    expect(imageFromRgba(rgba, 2, 1, 4).data).toEqual(rgba);
    expect(Array.from(imageFromGrey(Uint8Array.from([5, 6]), 2, 1).data)).toEqual([5, 6]);
  });
});
