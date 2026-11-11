import { BufferAttribute, BufferGeometry } from 'three';

/**
 * R30: a copy of the geometry without the hidden triangles and without the vertices only they used, so counts and bounds see the visible part.
 * Attributes come out as plain Float32 and the index as Uint32; the geometry given is left alone.
 */
export function removeHiddenTriangles(geometry: BufferGeometry, hidden: Uint8Array): BufferGeometry {
  const sourceIndex = geometry.index?.array;
  const vertexCount = geometry.getAttribute('position').count;
  const triangleCount = hidden.length;
  const newOfOld = new Int32Array(vertexCount).fill(-1);
  const kept: number[] = [];
  const index: number[] = [];
  for (let t = 0; t < triangleCount; t += 1) {
    if (hidden[t]) continue;
    for (let k = 0; k < 3; k += 1) {
      const old = sourceIndex ? sourceIndex[t * 3 + k]! : t * 3 + k;
      if (newOfOld[old]! < 0) {
        newOfOld[old] = kept.length;
        kept.push(old);
      }
      index.push(newOfOld[old]!);
    }
  }
  const result = new BufferGeometry();
  for (const [name, attribute] of Object.entries(geometry.attributes)) {
    const size = attribute.itemSize;
    const array = new Float32Array(kept.length * size);
    const read = [(i: number) => attribute.getX(i), (i: number) => attribute.getY(i), (i: number) => attribute.getZ(i), (i: number) => attribute.getW(i)];
    kept.forEach((old, n) => {
      for (let k = 0; k < size; k += 1) array[n * size + k] = read[k]!(old);
    });
    result.setAttribute(name, new BufferAttribute(array, size));
  }
  result.setIndex(new BufferAttribute(Uint32Array.from(index), 1));
  return result;
}
