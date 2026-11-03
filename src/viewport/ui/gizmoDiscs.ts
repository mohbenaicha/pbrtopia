import { Vector3, type Quaternion } from 'three';
import type { ViewAxis } from '../cameraRig';

interface GizmoDisc {
  axis: ViewAxis;
  label: 'X' | 'Y' | 'Z';
  positive: boolean;
  x: number; // pixels right of the gizmo centre
  y: number; // pixels below the gizmo centre
  depth: number; // 1 facing the viewer, -1 facing away
}

// Letters follow Blender's Z-up naming (viewport-layout R13): the vertical axis (three's Y) reads Z and the depth axis (three's Z) reads Y.
const AXIS_DIRECTIONS: { axis: ViewAxis; label: GizmoDisc['label']; positive: boolean; direction: Vector3 }[] = [
  { axis: '+x', label: 'X', positive: true, direction: new Vector3(1, 0, 0) },
  { axis: '-x', label: 'X', positive: false, direction: new Vector3(-1, 0, 0) },
  { axis: '+y', label: 'Z', positive: true, direction: new Vector3(0, 1, 0) },
  { axis: '-y', label: 'Z', positive: false, direction: new Vector3(0, -1, 0) },
  { axis: '+z', label: 'Y', positive: true, direction: new Vector3(0, 0, 1) },
  { axis: '-z', label: 'Y', positive: false, direction: new Vector3(0, 0, -1) },
];

// Where each of the six axis discs sits for a camera orientation, listed back to front so the nearest is drawn last.
export function computeGizmoDiscs(cameraQuaternion: Quaternion, radius: number): GizmoDisc[] {
  const worldToCamera = cameraQuaternion.clone().invert();
  return AXIS_DIRECTIONS.map(({ axis, label, positive, direction }) => {
    const inCamera = direction.clone().applyQuaternion(worldToCamera);
    return { axis, label, positive, x: inCamera.x * radius, y: -inCamera.y * radius, depth: inCamera.z };
  }).sort((a, b) => a.depth - b.depth);
}
