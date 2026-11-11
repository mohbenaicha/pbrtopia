/** The mesh's pose in previewGroup: a turn around the vertical axis and one around the horizontal axis, never a roll (preview R20). */
export interface TurntablePose {
  yaw: number;
  pitch: number;
}

export const DEFAULT_POSE: TurntablePose = { yaw: 0, pitch: 0 };

/** The wheel dolly, as a multiple of the default distance (preview R22). */
export const DOLLY_MIN = 0.4;
export const DOLLY_MAX = 3;
const DOLLY_STEP = 1.1;
const MAX_PITCH = Math.PI / 2;

/** A drag across the whole smaller side of the viewport turns the mesh by half a turn. A drag of zero length returns the same pose (R20: no frame). */
export function turnPose(pose: TurntablePose, dx: number, dy: number, smallerSide: number): TurntablePose {
  if (dx === 0 && dy === 0) return pose;
  const perPixel = Math.PI / Math.max(smallerSide, 1);
  const pitch = Math.min(MAX_PITCH, Math.max(-MAX_PITCH, pose.pitch + dy * perPixel));
  return { yaw: pose.yaw + dx * perPixel, pitch };
}

/** One wheel notch: direction +1 moves the camera away, -1 closer. */
export function dollyBy(factor: number, direction: number): number {
  return Math.min(DOLLY_MAX, Math.max(DOLLY_MIN, factor * DOLLY_STEP ** direction));
}

/** Whether the view is the mesh's default one: `home` is its default pose (the Plane's differs, preview R62). */
export function isDefaultView(pose: TurntablePose, dolly: number, home: TurntablePose = DEFAULT_POSE): boolean {
  return pose.yaw === home.yaw && pose.pitch === home.pitch && dolly === 1;
}
