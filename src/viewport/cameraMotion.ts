import { Quaternion, type Box3 } from 'three';
import { viewDirectionForAxis, type CameraRig, type Projection, type ViewAxis } from './cameraRig';
import { runCameraTransition } from './cameraTransition';
import type { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';

interface CameraMotionParts {
  rig: CameraRig;
  orbit: { controls: OrbitControls; applyDistanceLimits(): void };
  setProjection(projection: Projection): void;
  onCameraMoved(): void; // the rig's cameras are in sync and the viewport redraws
}

export interface CameraMotion {
  resetView(): void;
  snapToAxis(axis: ViewAxis): void;
  frameBounds(box: Box3): void; // the box fills the view and becomes the home view that resetView returns to
  cancel(): void; // stops a running snap transition
}

// The camera moves a viewport makes by itself: the animated snap to an axis, the reset and framing a box. A drag on the controls cancels a snap.
export function createCameraMotion({ rig, orbit, setProjection, onCameraMoved }: CameraMotionParts): CameraMotion {
  let cancelTransition = (): void => undefined;
  orbit.controls.addEventListener('start', () => cancelTransition());

  const startSnap = (axis: ViewAxis): void => {
    const fromDirection = rig.perspective.position.clone().sub(rig.target).normalize();
    const fromTarget = rig.target.clone();
    const fromDistance = rig.distance();
    const toDirection = viewDirectionForAxis(axis);
    const toTarget = rig.homeCenter();
    const toDistance = rig.homeDistance();
    const turn = new Quaternion().setFromUnitVectors(fromDirection, toDirection);
    cancelTransition = runCameraTransition((progress) => {
      rig.target.lerpVectors(fromTarget, toTarget, progress);
      const direction = progress === 1 ? toDirection : fromDirection.clone().applyQuaternion(new Quaternion().slerp(turn, progress));
      rig.placeCamera(direction, fromDistance + (toDistance - fromDistance) * progress);
      orbit.controls.update();
      onCameraMoved();
    });
  };

  return {
    resetView() {
      cancelTransition();
      rig.resetView();
      orbit.controls.update();
      onCameraMoved();
    },
    snapToAxis(axis) {
      cancelTransition();
      setProjection('orthographic');
      startSnap(axis);
    },
    frameBounds(box) {
      cancelTransition();
      rig.frameBounds(box);
      orbit.applyDistanceLimits();
      orbit.controls.update();
      onCameraMoved();
    },
    cancel: () => cancelTransition(),
  };
}
