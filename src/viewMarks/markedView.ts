export type Direction = readonly [number, number, number];

// One core view of a snapshot sheet as plain geometry (snapshot-orientation contracts).
export interface MarkedView {
  content: { x: number; y: number; w: number; h: number }; // pixels, top-left origin
  right: Direction; // world direction of the image's rightward axis
  up: Direction; // world direction of the image's upward axis
  across: readonly [number, number]; // world coordinate along `right` at the left and right edge of content
  down: readonly [number, number]; // world coordinate along `up` at the top and bottom edge of content
}
