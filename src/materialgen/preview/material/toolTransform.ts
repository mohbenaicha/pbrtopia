// Imageops R53-R56, preview R58: the transform an open Crop or Mirror tool puts on every map sample in the viewport's shaders, as plain numbers.

export type ToolEdge = 'top' | 'left' | 'right' | 'bottom';

/** One result quadrant of a mirror: the source quadrant (0 TL, 1 TR, 2 BL, 3 BR) it copies and whether the copy is flipped. */
export interface ToolQuadrant {
  from: 0 | 1 | 2 | 3;
  flipX: boolean;
  flipY: boolean;
}

export type ToolPlan = readonly [ToolQuadrant, ToolQuadrant, ToolQuadrant, ToolQuadrant]; // by result quadrant: TL, TR, BL, BR
export type ToolMarks = readonly [boolean, boolean, boolean, boolean]; // the selected quadrants, TL, TR, BL, BR

export type ToolTransform =
  | { kind: 'crop'; rect: { x: number; y: number; width: number; height: number }; edge: ToolEdge | null } // the rectangle in fractions of the picture, first row on top
  | { kind: 'mirror'; plan: ToolPlan | null; marked: ToolMarks }; // no plan: each quadrant as it is

export interface ToolUniformValues {
  mode: 0 | 1 | 2; // 0 none, 1 crop, 2 mirror
  rect: [number, number, number, number]; // crop: x, y, width, height
  plan: number[]; // mirror: four vec4 (source quadrant, flip x, flip y, unused), by result quadrant
  marks: [number, number, number, number]; // crop: the marked edge code in [0]; mirror: 1 for each selected quadrant
}

const EDGE_CODE: Record<ToolEdge, number> = { top: 1, left: 2, right: 3, bottom: 4 };
const NO_RECT: ToolUniformValues['rect'] = [0, 0, 1, 1];
const IDENTITY_PLAN = [0, 0, 0, 0, 1, 0, 0, 0, 2, 0, 0, 0, 3, 0, 0, 0];

/** The shader numbers for a transform. A whole picture with no edge marked is mode 0, so the shaders skip the transform altogether (imageops R58). */
export function toolUniformValues(transform: ToolTransform | null): ToolUniformValues {
  if (transform === null) return { mode: 0, rect: [...NO_RECT], plan: [...IDENTITY_PLAN], marks: [0, 0, 0, 0] };
  if (transform.kind === 'crop') {
    const { x, y, width, height } = transform.rect;
    const whole = x === 0 && y === 0 && width === 1 && height === 1;
    return { mode: whole && transform.edge === null ? 0 : 1, rect: [x, y, width, height], plan: [...IDENTITY_PLAN], marks: [transform.edge === null ? 0 : EDGE_CODE[transform.edge], 0, 0, 0] };
  }
  const plan = transform.plan === null ? [...IDENTITY_PLAN] : transform.plan.flatMap((quadrant) => [quadrant.from, quadrant.flipX ? 1 : 0, quadrant.flipY ? 1 : 0, 0]);
  const [tl, tr, bl, br] = transform.marked;
  return { mode: 2, rect: [...NO_RECT], plan, marks: [tl ? 1 : 0, tr ? 1 : 0, bl ? 1 : 0, br ? 1 : 0] };
}
