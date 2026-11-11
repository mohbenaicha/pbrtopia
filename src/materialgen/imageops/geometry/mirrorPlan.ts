// Imageops R32: which quadrant of the result copies which quadrant of the source, and whether the copy is flipped.

export const QUADRANTS = ['TL', 'TR', 'BL', 'BR'] as const;
export type Quadrant = (typeof QUADRANTS)[number];
export type MirrorMode = 'pair' | 'x' | 'y' | 'around';

export interface QuadrantSource {
  from: Quadrant;
  flipX: boolean;
  flipY: boolean;
}

export type MirrorPlan = Record<Quadrant, QuadrantSource>;

const HORIZONTAL_NEIGHBOUR: Record<Quadrant, Quadrant> = { TL: 'TR', TR: 'TL', BL: 'BR', BR: 'BL' };
const VERTICAL_NEIGHBOUR: Record<Quadrant, Quadrant> = { TL: 'BL', BL: 'TL', TR: 'BR', BR: 'TR' };
const isTop = (quadrant: Quadrant): boolean => quadrant === 'TL' || quadrant === 'TR';

function pairIsAdjacent(selection: ReadonlySet<Quadrant>): boolean {
  const [a, b] = [...selection] as [Quadrant, Quadrant];
  return HORIZONTAL_NEIGHBOUR[a] === b || VERTICAL_NEIGHBOUR[a] === b;
}

/** The modes the selection fits: a pair needs two adjacent quadrants, the others exactly one. */
export function availableMirrorModes(selection: ReadonlySet<Quadrant>): MirrorMode[] {
  if (selection.size === 1) return ['x', 'y', 'around'];
  if (selection.size === 2 && pairIsAdjacent(selection)) return ['pair'];
  return [];
}

/** The plan for a mode and selection, or null when the selection does not fit the mode. Untouched quadrants copy themselves. */
export function planMirror(mode: MirrorMode, selection: ReadonlySet<Quadrant>): MirrorPlan | null {
  if (!availableMirrorModes(selection).includes(mode)) return null;
  const plan = Object.fromEntries(QUADRANTS.map((quadrant) => [quadrant, { from: quadrant, flipX: false, flipY: false }])) as MirrorPlan;
  const reflect = (from: Quadrant, to: Quadrant, flipX: boolean, flipY: boolean): void => {
    plan[to] = { from, flipX, flipY };
  };
  const sources = [...selection];
  if (mode === 'pair') {
    const sameRow = isTop(sources[0]!) === isTop(sources[1]!);
    for (const quadrant of sources) {
      if (sameRow) reflect(quadrant, VERTICAL_NEIGHBOUR[quadrant], false, true);
      else reflect(quadrant, HORIZONTAL_NEIGHBOUR[quadrant], true, false);
    }
    return plan;
  }
  const source = sources[0]!;
  if (mode === 'x' || mode === 'around') reflect(source, HORIZONTAL_NEIGHBOUR[source], true, false);
  if (mode === 'y' || mode === 'around') reflect(source, VERTICAL_NEIGHBOUR[source], false, true);
  if (mode === 'around') reflect(source, HORIZONTAL_NEIGHBOUR[VERTICAL_NEIGHBOUR[source]], true, true);
  return plan;
}
