import { MOUSE } from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import type { CameraRig } from './cameraRig';

export interface OrbitSetup {
  controls: OrbitControls;
  applyDistanceLimits(): void;
  dispose(): void;
}

// Right button orbits, middle pans, the wheel zooms, the left button is left for the mode tools. The controls drive the rig's perspective camera and share its target.
// OrbitControls suppresses the canvas context menu itself; double-click resets the view.
export function createOrbitControls(rig: CameraRig, canvas: HTMLCanvasElement, onResetView: () => void): OrbitSetup {
  const controls = new OrbitControls(rig.perspective, canvas);
  controls.target = rig.target;
  controls.enableDamping = false;
  controls.screenSpacePanning = true;
  controls.mouseButtons = { LEFT: null, MIDDLE: MOUSE.PAN, RIGHT: MOUSE.ROTATE };

  const applyDistanceLimits = (): void => {
    const { min, max } = rig.distanceLimits();
    controls.minDistance = min;
    controls.maxDistance = max;
  };
  applyDistanceLimits();

  const onDoubleClick = (): void => onResetView();
  canvas.addEventListener('dblclick', onDoubleClick);

  return {
    controls,
    applyDistanceLimits,
    dispose() {
      canvas.removeEventListener('dblclick', onDoubleClick);
      controls.dispose();
    },
  };
}
