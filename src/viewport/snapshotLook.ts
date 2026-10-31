import type { Scene } from 'three';

// Generate R37, engine R10: what the atlas snapshots draw when the atlas render is "Current viewport": the viewport's own scene (its model with the
// look it shows now, the wireframe and the environment light), without the grid and the background, which would spoil the uniform tile background.
// The shape is the engine's `SnapshotLook`; the app passes one to the other, so the two modules do not import each other.
export interface SnapshotLook {
  scene: Scene;
  enter(): () => void; // takes the grid and the background out; the function returned puts them back
}

export function createSnapshotLook(scene: Scene, hideGrid: () => () => void): SnapshotLook {
  return {
    scene,
    enter() {
      const background = scene.background;
      const showGrid = hideGrid();
      scene.background = null;
      return () => {
        scene.background = background;
        showGrid();
      };
    },
  };
}
