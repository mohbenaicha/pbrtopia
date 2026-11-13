import type { PreviewMesh } from '@mat/storage';

/**
 * Imageops R72: how far the picture is turned on screen, in degrees clockwise, for the plane picker of an open Crop or Mirror. Only the Plane (preview R62) shows it:
 * its camera orbits and the Plane stays still, so a camera taken to the right shows the picture turned clockwise by the camera's yaw. A mesh that turns itself keeps
 * its picture upright for the picker.
 */
export function pictureTurnOf(view: { mesh: PreviewMesh; yaw: number }): number {
  return view.mesh === 'plane' ? (view.yaw * 180) / Math.PI : 0;
}
