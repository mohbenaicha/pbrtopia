import { UV_MARGIN, type UvMesh } from './uprightTypes';

/** normal-map R15: true when every UV used by a triangle lies within UV_MARGIN of 0..1; a value that is not a number never does. */
export function isUvInsidePicture(mesh: UvMesh): boolean {
  for (let corner = 0; corner < mesh.indices.length; corner += 1) {
    const vertex = mesh.indices[corner]!;
    for (let axis = 0; axis < 2; axis += 1) {
      const value = mesh.uvs[vertex * 2 + axis]!;
      if (!(value >= -UV_MARGIN && value <= 1 + UV_MARGIN)) return false;
    }
  }
  return true;
}
