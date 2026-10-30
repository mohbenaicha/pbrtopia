import { MOUSE } from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import type { CameraRig } from './cameraRig';

interface OrbitSetup {
  controls: OrbitControls;
  applyDistanceLimits(): void;
  dispose(): void;
}

// Right button orbits, middle pans, the wheel zooms, the left button is left for the mode tools. The controls drive the rig's perspective camera and share its target.
// OrbitControls suppresses the canvas context menu itself. A double-click does nothing: it used to reset the view, which a double left click in the mode tools triggered by accident.
export function createOrbitControls(rig: CameraRig, canvas: HTMLCanvasElement): OrbitSetup {
  const controls = new OrbitControls(rig.perspective, canvas);
  controls.target = rig.target;
  controls.enableDamping = false;
  controls.screenSpacePanning = true;
  controls.zoomToCursor = true; // the wheel zooms toward the point under the pointer, so the camera can reach the surface (mode R20)
  controls.mouseButtons = { LEFT: null, MIDDLE: MOUSE.PAN, RIGHT: MOUSE.ROTATE };

  const applyDistanceLimits = (): void => {
    const { min, max } = rig.distanceLimits();
    controls.minDistance = min;
    controls.maxDistance = max;
  };
  applyDistanceLimits();

  return {
    controls,
    applyDistanceLimits,
    dispose() {
      controls.dispose();
    },
  };
}
