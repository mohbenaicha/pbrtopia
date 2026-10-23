import { MathUtils, type BufferGeometry, type Mesh, type Object3D } from 'three';
import { toCreasedNormals } from 'three/examples/jsm/utils/BufferGeometryUtils.js';

interface ModelSmoothing {
  apply(root: Object3D, angleDeg: number): boolean; // true when any mesh got different geometry
  request(root: Object3D, angleDeg: number, onApplied: () => void): void; // apply(), at most once per 200 ms; the last angle asked for wins
  cancel(): void; // drops a waiting request
  dispose(root: Object3D): void; // puts the model's own geometry back and frees what was built
}

const MIN_GAP_MS = 200;
const OFF_DEG = 180;

interface MeshGeometry {
  original: BufferGeometry;
  built?: BufferGeometry | undefined;
  builtAtDeg?: number | undefined;
}

const isModelMesh = (object: Object3D): object is Mesh => (object as Mesh).isMesh === true && object.userData['isWireframeOverlay'] !== true;

// Auto smooth: rebuilds each mesh's normals with a crease angle (faces meeting at less than the angle are averaged, 0 is faceted, 180 is Off and keeps the model's own).
// The model's own geometry is kept untouched, so Off and every new angle start from it.
export function createModelSmoothing(): ModelSmoothing {
  const geometries = new Map<Mesh, MeshGeometry>();
  let timer: ReturnType<typeof setTimeout> | undefined;
  let lastRunAt = Number.NEGATIVE_INFINITY;
  let waiting: { root: Object3D; angleDeg: number; onApplied: () => void } | undefined;

  const meshesIn = (root: Object3D): Mesh[] => {
    const found: Mesh[] = [];
    root.traverse((object) => {
      if (isModelMesh(object)) found.push(object);
    });
    return found;
  };

  const showOriginal = (mesh: Mesh, record: MeshGeometry): boolean => {
    if (!record.built) return false;
    mesh.geometry = record.original;
    record.built.dispose();
    record.built = undefined;
    record.builtAtDeg = undefined;
    return true;
  };

  const showCreased = (mesh: Mesh, record: MeshGeometry, angleDeg: number): boolean => {
    if (record.built && record.builtAtDeg === angleDeg) return false;
    // A geometry without an index is smoothed in place by three, so it works on a copy to keep the model's own normals.
    const source = record.original.index === null ? record.original.clone() : record.original;
    const built = toCreasedNormals(source, MathUtils.degToRad(angleDeg));
    record.built?.dispose();
    record.built = built;
    record.builtAtDeg = angleDeg;
    mesh.geometry = built;
    return true;
  };

  const apply = (root: Object3D, angleDeg: number): boolean => {
    let changed = false;
    for (const mesh of meshesIn(root)) {
      let record = geometries.get(mesh);
      if (!record) {
        if (!mesh.geometry.getAttribute('position')) continue;
        record = { original: mesh.geometry };
        geometries.set(mesh, record);
      }
      const didChange = angleDeg >= OFF_DEG ? showOriginal(mesh, record) : showCreased(mesh, record, angleDeg);
      changed = changed || didChange;
    }
    return changed;
  };

  const cancel = (): void => {
    if (timer !== undefined) clearTimeout(timer);
    timer = undefined;
    waiting = undefined;
  };

  return {
    apply,
    request(root, angleDeg, onApplied) {
      waiting = { root, angleDeg, onApplied };
      if (timer !== undefined) return;
      const delay = Math.max(0, MIN_GAP_MS - (Date.now() - lastRunAt));
      timer = setTimeout(() => {
        timer = undefined;
        const job = waiting;
        waiting = undefined;
        lastRunAt = Date.now();
        if (job && apply(job.root, job.angleDeg)) job.onApplied();
      }, delay);
    },
    cancel,
    dispose(root) {
      cancel();
      for (const mesh of meshesIn(root)) {
        const record = geometries.get(mesh);
        if (!record) continue;
        showOriginal(mesh, record);
        geometries.delete(mesh);
      }
    },
  };
}
