import type { Direction } from './markedView';

export type SideName = 'front' | 'back' | 'left' | 'right' | 'top' | 'bottom';

export interface ObjectSide {
  name: SideName;
  colourName: string; // the word the prompts use
  rgb: readonly [number, number, number]; // the colour the strips are painted in
  letter: string;
}

// The one table of sides (snapshot-orientation R2, R4): painted marks and prompt words both come from it.
export const OBJECT_SIDES: readonly ObjectSide[] = [
  { name: 'front', colourName: 'green', rgb: [0x00, 0xc8, 0x53], letter: 'F' },
  { name: 'back', colourName: 'magenta', rgb: [0xff, 0x00, 0xc8], letter: 'Ba' },
  { name: 'left', colourName: 'red', rgb: [0xff, 0x2a, 0x2a], letter: 'L' },
  { name: 'right', colourName: 'cyan', rgb: [0x00, 0xd5, 0xff], letter: 'R' },
  { name: 'top', colourName: 'blue', rgb: [0x1e, 0x64, 0xff], letter: 'T' },
  { name: 'bottom', colourName: 'yellow', rgb: [0xff, 0xd0, 0x00], letter: 'Bo' },
];

// Per world axis, the side towards its positive and its negative end.
const AXIS_SIDES: readonly (readonly [SideName, SideName])[] = [
  ['right', 'left'],
  ['top', 'bottom'],
  ['front', 'back'],
];

// The side of the object a world direction points to: its largest component and that component's sign.
export function findSideFacing(direction: Direction): ObjectSide {
  let axis = 0;
  for (let other = 1; other < 3; other += 1) if (Math.abs(direction[other]!) > Math.abs(direction[axis]!)) axis = other;
  const name = AXIS_SIDES[axis]![direction[axis]! >= 0 ? 0 : 1];
  return OBJECT_SIDES.find((side) => side.name === name)!;
}
