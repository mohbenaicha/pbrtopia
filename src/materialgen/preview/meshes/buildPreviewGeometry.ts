import { PlaneGeometry, SphereGeometry, type BufferGeometry } from 'three';
import type { PreviewMesh } from '@mat/storage';
import { segmentsFor } from '../math/meshSegments';
import { buildMaterialBallGeometry } from './buildMaterialBallGeometry';
import { clampUvs } from './clampUvs';

/** Preview R2, R3, R39: the geometry of one preview mesh at a resolution level. The plane is always square (every map is). */
export function buildPreviewGeometry(mesh: PreviewMesh, resolution: number): BufferGeometry {
  const segments = segmentsFor(resolution);
  if (mesh === 'plane') return new PlaneGeometry(1, 1, segments, segments);
  if (mesh === 'materialBall') return buildMaterialBallGeometry();
  return clampUvs(new SphereGeometry(0.5, segments, segments / 2));
}
