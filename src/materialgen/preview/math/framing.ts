/** Half the size of what the camera must see, in the camera's right, up and forward directions (mesh units). */
export interface HalfExtents {
  halfWidth: number;
  halfHeight: number;
  halfDepth: number;
}

/** The share of the smaller viewport side kept free around the mesh at the default view (preview R5, a proposal). */
export const FRAME_MARGIN = 0.05;

/**
 * Preview R5: the camera distance, from the mesh centre, at which the mesh is fully visible with the margin on every side. The
 * nearest surface is `halfDepth` closer than the centre, so the visible window is measured there (conservative for a ball).
 */
export function defaultDistance(extents: HalfExtents, fovDeg: number, aspect: number): number {
  const reach = Math.tan((fovDeg * Math.PI) / 360) * (1 - 2 * FRAME_MARGIN); // the margin is kept on both sides of the smaller side
  const safeAspect = aspect > 0 ? aspect : 1;
  return extents.halfDepth + Math.max(extents.halfHeight / reach, extents.halfWidth / (reach * safeAspect));
}
