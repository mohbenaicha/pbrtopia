import { useEffect } from 'react';
import type { PreviewScene } from '../scene/createPreviewScene';
import { pictureTurnOf } from '../math/viewAngle';

/**
 * Imageops R72, R74: while `active` (a Crop or Mirror panel is open) reads the view once per frame and reports the picture's turn in degrees when it is new, and on
 * the first frame. Nothing runs while it is not active, and the camera never leaves the preview: only the one number does.
 */
export function useViewAngleReport(scene: Pick<PreviewScene, 'view'> | null, active: boolean, report: (degrees: number) => void): void {
  useEffect(() => {
    if (scene === null || !active) return undefined;
    let last: number | null = null;
    let frame = 0;
    const tick = (): void => {
      const degrees = pictureTurnOf(scene.view());
      if (degrees !== last) {
        last = degrees;
        report(degrees);
      }
      frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [scene, active, report]);
}
