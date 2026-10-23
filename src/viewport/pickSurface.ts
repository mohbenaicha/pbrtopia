import { Matrix3, Raycaster, Vector2, Vector3, type BufferGeometry, type Camera, type Mesh, type Object3D } from 'three';
import { acceleratedRaycast, MeshBVH } from 'three-mesh-bvh';

export interface SurfaceHit {
  point: Vector3; // world space
  normal: Vector3; // world space, unit length, turned to face the viewer
}

export type SurfacePicker = (clientX: number, clientY: number) => SurfaceHit | null;

interface SurfacePickerOptions {
  canvas: Pick<HTMLCanvasElement, 'getBoundingClientRect'>;
  camera: () => Camera;
  model: () => Object3D | undefined;
}

type BvhGeometry = BufferGeometry & { boundsTree?: MeshBVH };

// Finds where a screen position meets the model. Each mesh gets a bounding-volume tree the first time it is picked, so later picks are fast.
export function createSurfacePicker({ canvas, camera, model }: SurfacePickerOptions): SurfacePicker {
  const raycaster = new Raycaster();
  (raycaster as Raycaster & { firstHitOnly: boolean }).firstHitOnly = true;
  const prepared = new WeakSet<Mesh>();
  const ndc = new Vector2();

  const prepare = (root: Object3D): void => {
    root.traverse((object) => {
      const mesh = object as Mesh;
      if (!mesh.isMesh || prepared.has(mesh) || mesh.userData['isWireframeOverlay'] === true) return;
      const geometry = mesh.geometry as BvhGeometry;
      geometry.boundsTree ??= new MeshBVH(geometry);
      mesh.raycast = acceleratedRaycast;
      prepared.add(mesh);
    });
  };

  return (clientX, clientY) => {
    const root = model();
    if (!root) return null;
    const rect = canvas.getBoundingClientRect();
    ndc.set(((clientX - rect.left) / rect.width) * 2 - 1, -(((clientY - rect.top) / rect.height) * 2 - 1));
    const view = camera();
    view.updateMatrixWorld();
    root.updateMatrixWorld(true);
    prepare(root);
    raycaster.setFromCamera(ndc, view);
    const hit = raycaster.intersectObject(root, true)[0];
    if (!hit?.face) return null;
    const normal = hit.face.normal.clone().applyMatrix3(new Matrix3().getNormalMatrix(hit.object.matrixWorld)).normalize();
    if (normal.dot(raycaster.ray.direction) > 0) normal.negate();
    return { point: hit.point.clone(), normal };
  };
}
