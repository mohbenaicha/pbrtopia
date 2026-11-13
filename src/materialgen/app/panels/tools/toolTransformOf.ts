import { QUADRANTS, type CropEdge, type CropRect, type MirrorPlan, type Quadrant, type SeamParams } from '@mat/imageops';
import type { ToolMarks, ToolPlan, ToolQuadrant, ToolTransform } from '@mat/preview';

// Imageops R54: the panels hold pixels of S and quadrant names; the viewport's shaders take fractions of the picture and quadrant indexes.

const indexOf = (quadrant: Quadrant): 0 | 1 | 2 | 3 => QUADRANTS.indexOf(quadrant) as 0 | 1 | 2 | 3; // TL TR BL BR

/** The crop rectangle of the panel (pixels of the S x S working copy) as the viewport's transform, with the edge button under the pointer. */
export const cropTransform = (rect: CropRect, size: number, edge: CropEdge | null): ToolTransform => ({
  kind: 'crop',
  rect: { x: rect.x / size, y: rect.y / size, width: rect.width / size, height: rect.height / size },
  edge,
});

/** The Blend edges settings of the panel (the depth as a fraction of the side, the Canny profile or none) as the viewport's transform. */
export const seamTransform = ({ depth, profile }: SeamParams): ToolTransform => ({ kind: 'seam', depth, profile });

/** The mirror plan of the panel (null: none fits) and its selected quadrants as the viewport's transform. */
export function mirrorTransform(plan: MirrorPlan | null, selection: ReadonlySet<Quadrant>): ToolTransform {
  const quadrantOf = (result: Quadrant): ToolQuadrant => ({ from: indexOf(plan![result].from), flipX: plan![result].flipX, flipY: plan![result].flipY });
  return {
    kind: 'mirror',
    plan: plan === null ? null : (QUADRANTS.map(quadrantOf) as unknown as ToolPlan),
    marked: QUADRANTS.map((quadrant) => selection.has(quadrant)) as unknown as ToolMarks,
  };
}
