/** What the painter's ghost needs redone when the preview's surface changes (Tiling, or the height Scale and Level). */
export interface SurfaceFollow {
  surface(): { tilingX: number; tilingY: number }; // the surface now (the scene's, read again on each change)
  setGhostTiling(x: number, y: number): void;
  placeMarker(): void; // the line marker's ring, placed again with the new tiling
  repickGhost(): void; // the picture point under the last pointer position, picked afresh (no pointer move needed)
  showGhost(): void; // the ghost, drawn at that point
}

/**
 * Compositing R56: the ghost and the marker are placed from picture coordinates with the tiling, so a tiling change displaced them until the next pointer move. The
 * order matters: the new tiling first, then the marker, then the pick (which reads the same surface), then the ghost.
 */
export function followSurface(follow: SurfaceFollow): void {
  const { tilingX, tilingY } = follow.surface();
  follow.setGhostTiling(tilingX, tilingY);
  follow.placeMarker();
  follow.repickGhost();
  follow.showGhost();
}
