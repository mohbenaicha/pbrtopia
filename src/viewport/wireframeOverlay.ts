import { MeshBasicMaterial, type Mesh, type Object3D } from 'three';
import { createOverlayMesh } from './overlayMesh';

export interface WireframeOverlay {
  setVisible(visible: boolean): void;
  meshes(): Mesh[]; // the overlay meshes currently added
  dispose(): void;
}

const isModelMesh = (object: Object3D): object is Mesh => (object as Mesh).isMesh === true && object.userData['isWireframeOverlay'] !== true;

// A black wireframe child on every mesh, sharing the mesh's geometry. Calling setVisible(true) again covers meshes added since.
export function createWireframeOverlay(root: Object3D): WireframeOverlay {
  const material = new MeshBasicMaterial({ color: 0x000000, wireframe: true, polygonOffset: true, polygonOffsetFactor: -1, polygonOffsetUnits: -1 });
  let overlays: Mesh[] = [];
  const covered = new Set<Mesh>();

  const remove = (): void => {
    overlays.forEach((wire) => wire.removeFromParent());
    overlays = [];
    covered.clear();
  };

  return {
    setVisible(visible) {
      if (!visible) {
        remove();
        return;
      }
      const targets: Mesh[] = [];
      root.traverse((object) => {
        if (isModelMesh(object) && !covered.has(object)) targets.push(object);
      });
      for (const mesh of targets) {
        const wire = createOverlayMesh(mesh, material);
        mesh.add(wire);
        overlays.push(wire);
        covered.add(mesh);
      }
    },
    meshes: () => [...overlays],
    dispose() {
      remove();
      material.dispose();
    },
  };
}
