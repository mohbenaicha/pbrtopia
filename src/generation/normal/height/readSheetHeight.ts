import type { PixelPicture } from '../uprightTypes';

/** normal-height-edit R1: the height the model returned, read as Rec. 709 luma in 0..1 (a colour answer is read as its brightness). */
export function readSheetHeight(picture: PixelPicture): Float32Array {
  const count = picture.side * picture.side;
  const out = new Float32Array(count);
  for (let i = 0; i < count; i += 1) {
    out[i] = (0.2126 * picture.rgba[i * 4]! + 0.7152 * picture.rgba[i * 4 + 1]! + 0.0722 * picture.rgba[i * 4 + 2]!) / 255;
  }
  return out;
}
