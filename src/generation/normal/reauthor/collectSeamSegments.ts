// normal-reauthor R7: the seams of one mesh, as pairs of segments in texels of the picture. No DOM, no store.
import type { UvMesh } from '../uprightTypes';

export type SeamSegment = [x0: number, y0: number, x1: number, y1: number]; // texels; the end points keep the order of the 3D edge's smaller key
export type SeamSegmentPair = [SeamSegment, SeamSegment]; // the same 3D edge drawn in its two triangles: t along one is t along the other

const POSITION_GRID = 1e5; // positions are compared on a grid of 1/1e5 of the model's extent
const UV_TOLERANCE_TEXELS = 0.5;

/** One seam edge per 3D edge used by exactly two triangles whose uvs differ at either end by more than half a texel. */
export function collectSeamSegments(mesh: UvMesh, side: number): SeamSegmentPair[] {
  const { positions, uvs, indices } = mesh;
  let extent = 1e-9;
  for (let at = 0; at < positions.length; at += 1) extent = Math.max(extent, Math.abs(positions[at]!));
  const scale = POSITION_GRID / extent;
  const keyOfVertex = new Map<number, string>();
  const keyOf = (vertex: number): string => {
    let key = keyOfVertex.get(vertex);
    if (key === undefined) {
      key = `${Math.round(positions[vertex * 3]! * scale)},${Math.round(positions[vertex * 3 + 1]! * scale)},${Math.round(positions[vertex * 3 + 2]! * scale)}`;
      keyOfVertex.set(vertex, key);
    }
    return key;
  };
  const edges = new Map<string, SeamSegment[]>();
  for (let at = 0; at + 2 < indices.length; at += 3) {
    for (let corner = 0; corner < 3; corner += 1) {
      const from = indices[at + corner]!;
      const to = indices[at + ((corner + 1) % 3)]!;
      const fromKey = keyOf(from);
      const toKey = keyOf(to);
      if (fromKey === toKey) continue;
      const flip = fromKey > toKey;
      const first = flip ? to : from;
      const second = flip ? from : to;
      const edgeKey = flip ? `${toKey}|${fromKey}` : `${fromKey}|${toKey}`;
      const segment: SeamSegment = [uvs[first * 2]! * side, uvs[first * 2 + 1]! * side, uvs[second * 2]! * side, uvs[second * 2 + 1]! * side];
      const list = edges.get(edgeKey);
      if (list === undefined) edges.set(edgeKey, [segment]);
      else list.push(segment);
    }
  }
  const pairs: SeamSegmentPair[] = [];
  for (const list of edges.values()) {
    if (list.length !== 2) continue; // an open border (one triangle) or a fold of three or more is never a seam
    const [a, b] = list as SeamSegmentPair;
    const same = a.every((value, index) => Math.abs(value - b[index]!) <= UV_TOLERANCE_TEXELS);
    if (!same) pairs.push([a, b]);
  }
  return pairs;
}
