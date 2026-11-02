// Custom R3, R5: what the setup overlay draws of the sheets. Plain numbers: the engine's fit is turned into these by the app, so generation never imports the engine.

export interface SnapshotTrim {
  x: number; // the camera's silhouette box as fractions of its square snapshot
  y: number;
  w: number;
  h: number;
}

export interface PreviewTile {
  camera: number | null; // the core camera drawn in it; null for an aux tile (the aux views are chosen when the run starts)
  x: number; // the tile as fractions of the sheet's canvas
  y: number;
  w: number;
  h: number;
}

export interface SheetPreview {
  aspect: number; // canvas width / height
  tiles: PreviewTile[];
}
