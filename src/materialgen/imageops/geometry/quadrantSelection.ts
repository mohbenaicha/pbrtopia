import { QUADRANTS, type Quadrant } from './mirrorPlan';

// Imageops R32: the selection rules of the mirror toggles, as in Materialize. At most two quadrants, two must share an edge, never none.

const SHARES_EDGE: Record<Quadrant, readonly Quadrant[]> = { TL: ['TR', 'BL'], TR: ['TL', 'BR'], BL: ['TL', 'BR'], BR: ['TR', 'BL'] };

/** The selection after the user clicks `quadrant`: always a corner (one quadrant) or a half (two that share an edge). Returns a new set. */
export function toggleQuadrant(selection: ReadonlySet<Quadrant>, quadrant: Quadrant): ReadonlySet<Quadrant> {
  const chosen = QUADRANTS.filter((candidate) => selection.has(candidate)); // in picture order, so "the first of the two" is stable
  if (selection.has(quadrant)) return chosen.length === 1 ? new Set(chosen) : new Set(chosen.filter((candidate) => candidate !== quadrant));
  const neighbour = chosen.find((candidate) => SHARES_EDGE[quadrant].includes(candidate));
  return neighbour === undefined ? new Set([quadrant]) : new Set([neighbour, quadrant]);
}
