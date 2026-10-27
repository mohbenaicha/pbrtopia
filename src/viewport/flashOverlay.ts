import type { Material, Mesh, Object3D } from 'three';
import { createOverlayMesh } from './overlayMesh';

export interface FlashOverlay {
  show(material: Material | null): void; // translucent copies of every model mesh drawn with the material; null takes them away
  dispose(): void;
}

const isModelMesh = (object: Object3D): object is Mesh => (object as Mesh).isMesh === true && object.userData['isWireframeOverlay'] !== true;

// The layer flash (mode R16): the model keeps its look and the material is laid over it, so the texture stays visible under the tint.
export function createFlashOverlay(root: Object3D): FlashOverlay {
  let copies: Mesh[] = [];
  let shownMaterial: Material | null = null;

  const remove = (): void => {
    copies.forEach((copy) => copy.removeFromParent());
    copies = [];
    shownMaterial = null;
  };

  return {
    show(material) {
      if (material === shownMaterial) return;
      remove();
      if (material === null) return;
      const targets: Mesh[] = [];
      root.traverse((object) => {
        if (isModelMesh(object)) targets.push(object);
      });
      for (const mesh of targets) {
        const copy = createOverlayMesh(mesh, material);
        copy.userData['isFlashOverlay'] = true;
        copy.renderOrder = 1;
        mesh.add(copy);
        copies.push(copy);
      }
      shownMaterial = material;
    },
    dispose: remove,
  };
}
