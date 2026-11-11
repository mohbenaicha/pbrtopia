import type { TurntablePose } from './turntable';

/**
 * Preview R62: the Plane lies flat and the camera orbits it. The pose is reused: `yaw` is the camera's turn round the vertical axis (0 is the front), `pitch` its
 * elevation above the Plane.
 */
export const PLANE_DEFAULT_POSE: TurntablePose = { yaw: 0, pitch: Math.PI / 4 };

const MIN_ELEVATION = (5 * Math.PI) / 180; // never beneath the Plane
const MAX_ELEVATION = (85 * Math.PI) / 180; // never straight above, where "up" has no meaning for the camera

/** A drag across the whole smaller side of the viewport orbits half a turn. Dragging down raises the camera, dragging right takes it round to the left. A zero drag returns the same pose. */
export function orbitPlane(pose: TurntablePose, dx: number, dy: number, smallerSide: number): TurntablePose {
  if (dx === 0 && dy === 0) return pose;
  const perPixel = Math.PI / Math.max(smallerSide, 1);
  const pitch = Math.min(MAX_ELEVATION, Math.max(MIN_ELEVATION, pose.pitch + dy * perPixel));
  return { yaw: pose.yaw - dx * perPixel, pitch };
}

/** The direction from the Plane's centre to the camera for an orbit pose; length 1. */
export function planeCameraDirection(pose: TurntablePose): { x: number; y: number; z: number } {
  const flat = Math.cos(pose.pitch);
  return { x: Math.sin(pose.yaw) * flat, y: Math.sin(pose.pitch), z: Math.cos(pose.yaw) * flat };
}
