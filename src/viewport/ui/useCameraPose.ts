import { useEffect, useState } from 'react';
import type { Quaternion } from 'three';
import type { Projection } from '../cameraRig';
import type { Viewport } from '../createViewport';

export type PoseSource = Pick<Viewport, 'camera' | 'cameraRig' | 'on'>;

// The camera orientation and projection, re-read whenever the viewport reports a camera or projection change.
export function useCameraPose(viewport: PoseSource): { quaternion: Quaternion; projection: Projection } {
  const [, setChangeCount] = useState(0);
  useEffect(() => {
    const refresh = (): void => setChangeCount((count) => count + 1);
    const stopCamera = viewport.on('camera-change', refresh);
    const stopProjection = viewport.on('projection-changed', refresh);
    return () => {
      stopCamera();
      stopProjection();
    };
  }, [viewport]);
  return { quaternion: viewport.camera.quaternion, projection: viewport.cameraRig.projection };
}
