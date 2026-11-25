// normal-reauthor R5: the slope (x / z, y / z) of every base texel, scaled by tan(slopeDeg) / tan(45). No DOM, no store.
import { slopeFactor } from '../../../normalRecipe/reauthorParams';
import type { PixelPicture } from '../uprightTypes';

const CODE_CENTRE = 128;
const CODE_UNIT = 127; // a byte v means (v - 128) / 127

/** Two floats per texel (slope x, slope y). A texel with z <= 0 reads as flat. */
export function scaleSlope(base: PixelPicture, slopeDeg: number): Float32Array {
  const texels = base.side * base.side;
  const slopes = new Float32Array(texels * 2);
  const factor = slopeFactor(slopeDeg);
  const { rgba } = base;
  for (let at = 0; at < texels; at += 1) {
    const z = (rgba[at * 4 + 2]! - CODE_CENTRE) / CODE_UNIT;
    if (z <= 0) continue;
    slopes[at * 2] = (((rgba[at * 4]! - CODE_CENTRE) / CODE_UNIT) / z) * factor;
    slopes[at * 2 + 1] = (((rgba[at * 4 + 1]! - CODE_CENTRE) / CODE_UNIT) / z) * factor;
  }
  return slopes;
}
