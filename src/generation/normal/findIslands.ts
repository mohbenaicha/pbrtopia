import type { UvMesh } from './uprightTypes';

const POSITION_SCALE = 1e4;
const UV_SCALE = 1e5;

// normal-map R15: an island is the triangles joined through vertices that share a position and a uv (a vertex split only for a normal or a tangent does not cut an island).
// Returns the triangle numbers of each island, islands ordered by their first triangle.
export function findIslands(mesh: UvMesh): readonly (readonly number[])[] {
  const triangleCount = Math.floor(mesh.indices.length / 3);
  const parent = Int32Array.from({ length: triangleCount }, (_, i) => i);
  const find = (t: number): number => {
    let root = t;
    while (parent[root] !== root) root = parent[root]!;
    for (let next = parent[t]!; next !== root; next = parent[t]!) {
      parent[t] = root;
      t = next;
    }
    return root;
  };

  const firstTriangle = new Map<string, number>();
  for (let t = 0; t < triangleCount; t += 1) {
    for (let corner = 0; corner < 3; corner += 1) {
      const key = vertexKey(mesh, mesh.indices[t * 3 + corner]!);
      const seen = firstTriangle.get(key);
      if (seen === undefined) {
        firstTriangle.set(key, t);
      } else {
        const a = find(t);
        const b = find(seen);
        if (a !== b) parent[Math.max(a, b)] = Math.min(a, b); // the smaller number stays the root, so islands keep their first-triangle order
      }
    }
  }

  const islandOfRoot = new Map<number, number[]>();
  for (let t = 0; t < triangleCount; t += 1) {
    const root = find(t);
    const list = islandOfRoot.get(root);
    if (list === undefined) islandOfRoot.set(root, [t]);
    else list.push(t);
  }
  return [...islandOfRoot.values()];
}

function vertexKey(mesh: UvMesh, vertex: number): string {
  const p = vertex * 3;
  const u = vertex * 2;
  const { positions, uvs } = mesh;
  return `${Math.round(positions[p]! * POSITION_SCALE)},${Math.round(positions[p + 1]! * POSITION_SCALE)},${Math.round(positions[p + 2]! * POSITION_SCALE)}|${Math.round(uvs[u]! * UV_SCALE)},${Math.round(uvs[u + 1]! * UV_SCALE)}`;
}
