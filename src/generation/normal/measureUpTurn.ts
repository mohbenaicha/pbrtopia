import { MIN_UP_PROJECTION, type UvMesh } from './uprightTypes';

type Vec3 = readonly [number, number, number];

const sub = (a: Vec3, b: Vec3): Vec3 => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const dot = (a: Vec3, b: Vec3): number => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const cross = (a: Vec3, b: Vec3): Vec3 => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const length = (a: Vec3): number => Math.hypot(a[0], a[1], a[2]);
const scale = (a: Vec3, s: number): Vec3 => [a[0] * s, a[1] * s, a[2] * s];
const unit = (a: Vec3): Vec3 => scale(a, 1 / (length(a) || 1));

const MODEL_UP: Vec3 = [0, 1, 0];

/**
 * normal-map R16: the turn, in radians (clockwise positive, picture y down), that stands an island upright.
 * For each triangle whose up vector projected into its plane is at least MIN_UP_PROJECTION long, the angle of that projection
 * is measured from the picture's top toward its right; the angles are averaged as a circular mean weighted by 3D area. The turn is minus the mean.
 * An island with no such triangle is not turned (0).
 */
export function measureUpTurn(mesh: UvMesh, triangles: readonly number[], up: Vec3 = MODEL_UP): number {
  let sumCos = 0;
  let sumSin = 0;
  for (const t of triangles) {
    const a = mesh.indices[t * 3]!;
    const b = mesh.indices[t * 3 + 1]!;
    const c = mesh.indices[t * 3 + 2]!;
    const p0 = position(mesh, a);
    const e1 = sub(position(mesh, b), p0);
    const e2 = sub(position(mesh, c), p0);
    const du1 = mesh.uvs[b * 2]! - mesh.uvs[a * 2]!;
    const dv1 = mesh.uvs[b * 2 + 1]! - mesh.uvs[a * 2 + 1]!;
    const du2 = mesh.uvs[c * 2]! - mesh.uvs[a * 2]!;
    const dv2 = mesh.uvs[c * 2 + 1]! - mesh.uvs[a * 2 + 1]!;
    const det = du1 * dv2 - du2 * dv1;
    if (Math.abs(det) < 1e-12) continue;
    const r = 1 / det;
    const alongU = scale(sub(scale(e1, dv2), scale(e2, dv1)), r); // dP/du: the model's move for one picture step to the right
    const alongV = scale(sub(scale(e2, du1), scale(e1, du2)), r); // dP/dv: the model's move for one picture step down
    const faceCross = cross(e1, e2);
    const area = length(faceCross) / 2;
    if (area === 0) continue;
    const normal = unit(faceCross);
    const upInPlane = sub(up, scale(normal, dot(normal, up)));
    if (length(upInPlane) < MIN_UP_PROJECTION) continue;
    // Where up points in the picture: solve a * dP/du + b * dP/dv = up (a to the right, b down), so a stretched or sheared island is read as drawn.
    const uu = dot(alongU, alongU);
    const uv = dot(alongU, alongV);
    const vv = dot(alongV, alongV);
    const gram = uu * vv - uv * uv;
    if (Math.abs(gram) < 1e-24) continue;
    const toRight = (dot(alongU, upInPlane) * vv - dot(alongV, upInPlane) * uv) / gram;
    const toDown = (dot(alongV, upInPlane) * uu - dot(alongU, upInPlane) * uv) / gram;
    const angle = Math.atan2(toRight, -toDown); // from the picture's top toward its right
    sumCos += Math.cos(angle) * area;
    sumSin += Math.sin(angle) * area;
  }
  if (sumCos === 0 && sumSin === 0) return 0;
  return -Math.atan2(sumSin, sumCos);
}

function position(mesh: UvMesh, vertex: number): Vec3 {
  return [mesh.positions[vertex * 3]!, mesh.positions[vertex * 3 + 1]!, mesh.positions[vertex * 3 + 2]!];
}
