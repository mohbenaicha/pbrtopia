import { Vector3, type Camera, type OrthographicCamera, type PerspectiveCamera } from 'three';

const forward = new Vector3();
const offset = new Vector3();
const MIN_DEPTH = 1e-6;

// How many world units one screen pixel covers at a point: constant for the orthographic camera, growing with the distance along the view for the perspective one.
function worldUnitsPerPixel(camera: Camera, point: Vector3, heightPx: number): number {
  const orthographic = camera as OrthographicCamera;
  if (orthographic.isOrthographicCamera) return (orthographic.top - orthographic.bottom) / orthographic.zoom / heightPx;
  const perspective = camera as PerspectiveCamera;
  perspective.updateMatrixWorld();
  perspective.getWorldDirection(forward);
  const depth = Math.max(offset.copy(point).sub(perspective.position).dot(forward), MIN_DEPTH);
  return (2 * depth * Math.tan((perspective.fov * Math.PI) / 360)) / perspective.zoom / heightPx;
}

// A circle of `radiusPx` screen pixels around a point, as a radius in world units.
export function worldRadiusFromPixels(camera: Camera, point: Vector3, radiusPx: number, heightPx: number): number {
  return radiusPx * worldUnitsPerPixel(camera, point, heightPx);
}

// A world radius around a point, as a radius in screen pixels. The inverse of worldRadiusFromPixels.
export function pixelsFromWorldRadius(camera: Camera, point: Vector3, radiusWorld: number, heightPx: number): number {
  return radiusWorld / worldUnitsPerPixel(camera, point, heightPx);
}
