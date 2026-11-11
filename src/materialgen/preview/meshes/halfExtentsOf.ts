import type { BufferGeometry } from 'three';
import type { HalfExtents } from '../math/framing';

/** How far the geometry reaches from the origin along each axis (the camera looks down -z at the default pose). */
export function halfExtentsOf(geometry: BufferGeometry): HalfExtents {
  geometry.computeBoundingBox();
  const box = geometry.boundingBox!;
  return {
    halfWidth: Math.max(Math.abs(box.min.x), Math.abs(box.max.x)),
    halfHeight: Math.max(Math.abs(box.min.y), Math.abs(box.max.y)),
    halfDepth: Math.max(Math.abs(box.min.z), Math.abs(box.max.z)),
  };
}
