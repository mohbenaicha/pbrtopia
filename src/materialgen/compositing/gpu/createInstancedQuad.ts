import { InstancedBufferAttribute, InstancedBufferGeometry, Mesh, PlaneGeometry } from 'three';

/** How many instances one draw call carries; the callers flush when a batch is full. */
export const INSTANCES_PER_DRAW = 512;

export interface InstancedQuad {
  geometry: InstancedBufferGeometry;
  /** Per instance: centre x, centre y, size, angle. */
  place: Float32Array;
  /** Per instance: the atlas rectangle u0, v0, du, dv. */
  tile: Float32Array;
  /** Per instance: strength, hardness, shape flag, unused. */
  brush: Float32Array;
  mesh: Mesh;
}

/** One unit quad drawn many times with per-instance placement, tile and brush attributes (compositing A4: one instanced draw per map per frame). */
export function createInstancedQuad(): InstancedQuad {
  const base = new PlaneGeometry(1, 1);
  const geometry = new InstancedBufferGeometry();
  geometry.index = base.index;
  geometry.setAttribute('position', base.getAttribute('position'));
  const place = new Float32Array(INSTANCES_PER_DRAW * 4);
  const tile = new Float32Array(INSTANCES_PER_DRAW * 4);
  const brush = new Float32Array(INSTANCES_PER_DRAW * 4);
  geometry.setAttribute('iPlace', new InstancedBufferAttribute(place, 4));
  geometry.setAttribute('iTile', new InstancedBufferAttribute(tile, 4));
  geometry.setAttribute('iBrush', new InstancedBufferAttribute(brush, 4));
  const mesh = new Mesh(geometry);
  mesh.frustumCulled = false;
  return { geometry, place, tile, brush, mesh };
}

/** Tells the GPU that the first `count` instances of every attribute changed, and draws that many. */
export function setInstanceCount(quad: InstancedQuad, count: number): void {
  quad.geometry.instanceCount = count;
  for (const name of ['iPlace', 'iTile', 'iBrush']) {
    const attribute = quad.geometry.getAttribute(name) as InstancedBufferAttribute;
    attribute.clearUpdateRanges();
    attribute.addUpdateRange(0, count * 4);
    attribute.needsUpdate = true;
  }
}
