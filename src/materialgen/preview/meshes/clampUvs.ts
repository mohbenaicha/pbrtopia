import type { BufferGeometry } from 'three';

/** three.js offsets the u of a sphere's pole vertices by half a segment, which leaves a few UVs just outside 0 to 1; a repeating map must not see them (preview R57). */
export function clampUvs<G extends BufferGeometry>(geometry: G): G {
  const uv = geometry.getAttribute('uv');
  for (let i = 0; i < uv.array.length; i += 1) uv.array[i] = Math.min(1, Math.max(0, uv.array[i]!));
  uv.needsUpdate = true;
  return geometry;
}
