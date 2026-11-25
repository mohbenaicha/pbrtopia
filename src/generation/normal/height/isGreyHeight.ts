import type { PixelPicture } from '../uprightTypes';

/** normal-height-edit R14: a stored height base is a grey, opaque picture of the albedo's side; anything else is not one this app wrote. */
export function isGreyHeight(picture: PixelPicture, side: number): boolean {
  if (picture.side !== side || picture.rgba.length !== side * side * 4) return false;
  const { rgba } = picture;
  for (let i = 0; i < rgba.length; i += 4) {
    if (rgba[i] !== rgba[i + 1] || rgba[i] !== rgba[i + 2] || rgba[i + 3] !== 255) return false;
  }
  return true;
}
