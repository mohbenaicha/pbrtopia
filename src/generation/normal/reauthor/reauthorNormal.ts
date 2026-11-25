// normal-reauthor R5-R10: the whole re-authoring, from the base normal, in one pass. No DOM, no store.
// The legacy head (a picture without a stored height); the tail is shared with reauthorFromHeight.
import type { ReauthorParams } from '../../../normalRecipe/reauthorParams';
import type { PixelPicture, UvMesh } from '../uprightTypes';
import { scaleSlope } from './scaleSlope';
import { tailFromSlopes } from './tailFromSlopes';

/** The re-authored normal of `base` for `params` (already clamped). Pure: the inputs are not changed. */
export function reauthorNormal(base: PixelPicture, mesh: UvMesh, params: ReauthorParams): PixelPicture {
  return tailFromSlopes(scaleSlope(base, params.slopeDeg), base.side, mesh, params);
}
