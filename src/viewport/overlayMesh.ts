import { Mesh, SkinnedMesh, type Material } from 'three';

// A child mesh of `mesh` that draws the same geometry with `material`, for the overlays drawn on top of the model. A skinned mesh gets a
// skinned copy on the same skeleton and morph weights, so the overlay stays on the posed model, not on its bind pose. The copy is flagged as
// an overlay (the model traversals skip it) and is never picked.
export function createOverlayMesh(mesh: Mesh, material: Material): Mesh {
  let overlay: Mesh;
  if ((mesh as SkinnedMesh).isSkinnedMesh) {
    const skinned = mesh as SkinnedMesh;
    const copy = new SkinnedMesh(skinned.geometry, material);
    copy.bind(skinned.skeleton, skinned.bindMatrix);
    copy.bindMode = skinned.bindMode;
    copy.morphTargetInfluences = skinned.morphTargetInfluences;
    copy.morphTargetDictionary = skinned.morphTargetDictionary;
    overlay = copy;
  } else {
    overlay = new Mesh(mesh.geometry, material);
  }
  overlay.userData['isWireframeOverlay'] = true;
  overlay.raycast = () => undefined;
  return overlay;
}
