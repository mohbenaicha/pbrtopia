import { OBJECT_SIDES } from '../../viewMarks';

// Snapshot-orientation R7, R8: the words for the marks painted on the core views, built from the same table the painter uses.

const COLOURS = OBJECT_SIDES.map((side) => `${side.colourName} = ${side.name}`).join(', ');
const LETTERS = OBJECT_SIDES.map((side) => `${side.letter} = ${side.name}`).join(', ');

export function describeViewMarks(): string {
  return `The views in image 1 carry orientation guides. The coloured strip on each edge of a view shows which side of the object lies towards that edge (${COLOURS}). The letter in the top right corner of a view names the side of the object it shows (${LETTERS}). The grid lines behind the object mark its scale. Views without a letter are extra angles of the same object and carry no marks. The strips, letters and grid lines are guides only: they must not appear in the result, neither on the object nor around it.`;
}

export const IGNORE_VIEW_MARKS =
  'The views may carry orientation guides (coloured edge strips, a letter in a corner and grid lines behind the object): ignore them and never mention them.';
