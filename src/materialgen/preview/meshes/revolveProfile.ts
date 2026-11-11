import { BufferAttribute, BufferGeometry } from 'three';

/** One ring of a surface of revolution about the y axis: its radius and height, the surface normal in the (radius, y) plane and v along the profile (0 to 1). */
export interface ProfileRow {
  r: number;
  y: number;
  nr: number;
  ny: number;
  v: number;
}

/** The arrays that strips are appended to. */
export interface MeshArrays {
  positions: number[];
  normals: number[];
  uvs: number[];
  indices: number[];
}

export function createMeshArrays(): MeshArrays {
  return { positions: [], normals: [], uvs: [], indices: [] };
}

/**
 * Appends the surface made by turning `rows` once about the y axis in `segments` steps. The UV is only a placeholder (u the turn about the axis, v the row's own v):
 * the Material ball is textured by position. A row with radius 0 (a pole) adds no flat triangles. Each triangle is wound so that its face points the way its vertex
 * normals do.
 */
export function addRevolvedStrip(into: MeshArrays, rows: readonly ProfileRow[], segments: number): void {
  const base = into.positions.length / 3;
  const columns = segments + 1;
  for (const row of rows) {
    for (let j = 0; j < columns; j += 1) {
      const turn = j / segments;
      const cos = Math.cos(turn * 2 * Math.PI);
      const sin = Math.sin(turn * 2 * Math.PI);
      into.positions.push(row.r * cos, row.y, row.r * sin);
      into.normals.push(row.nr * cos, row.ny, row.nr * sin);
      into.uvs.push(turn, row.v);
    }
  }
  const at = (i: number, j: number): number => base + i * columns + j;
  for (let i = 0; i + 1 < rows.length; i += 1) {
    for (let j = 0; j < segments; j += 1) {
      const [a, b, c, d] = [at(i, j), at(i, j + 1), at(i + 1, j), at(i + 1, j + 1)];
      if (rows[i]!.r !== 0) pushOriented(into, a, b, c);
      if (rows[i + 1]!.r !== 0) pushOriented(into, b, d, c);
    }
  }
}

function pushOriented(into: MeshArrays, a: number, b: number, c: number): void {
  const p = into.positions;
  const n = into.normals;
  const e1 = [p[b * 3]! - p[a * 3]!, p[b * 3 + 1]! - p[a * 3 + 1]!, p[b * 3 + 2]! - p[a * 3 + 2]!];
  const e2 = [p[c * 3]! - p[a * 3]!, p[c * 3 + 1]! - p[a * 3 + 1]!, p[c * 3 + 2]! - p[a * 3 + 2]!];
  const face = [e1[1]! * e2[2]! - e1[2]! * e2[1]!, e1[2]! * e2[0]! - e1[0]! * e2[2]!, e1[0]! * e2[1]! - e1[1]! * e2[0]!];
  let agree = 0;
  for (let k = 0; k < 3; k += 1) agree += face[k]! * (n[a * 3 + k]! + n[b * 3 + k]! + n[c * 3 + k]!);
  if (agree >= 0) into.indices.push(a, b, c);
  else into.indices.push(a, c, b);
}

export function toBufferGeometry(from: MeshArrays): BufferGeometry {
  const geometry = new BufferGeometry();
  geometry.setAttribute('position', new BufferAttribute(new Float32Array(from.positions), 3));
  geometry.setAttribute('normal', new BufferAttribute(new Float32Array(from.normals), 3));
  geometry.setAttribute('uv', new BufferAttribute(new Float32Array(from.uvs), 2));
  geometry.setIndex(new BufferAttribute(from.positions.length / 3 > 65535 ? new Uint32Array(from.indices) : new Uint16Array(from.indices), 1));
  return geometry;
}
