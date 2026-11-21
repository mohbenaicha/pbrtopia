import type { EditControl, EditValues } from '../filters/editControls';

// Normal-from-height R6: the two parameters of the Normal tool, in the control shape the filter dialog draws.

export const normalControls: readonly EditControl[] = [
  { id: 'blur', label: 'Blur', category: 'surface', kind: 'slider', min: 0, max: 4, step: 0.05, defaultValue: 1 },
  { id: 'strength', label: 'Strength', category: 'surface', kind: 'slider', min: 5, max: 80, step: 1, defaultValue: 45 },
];

export const createDefaultNormalValues = (): EditValues => Object.fromEntries(normalControls.map((control) => [control.id, control.defaultValue]));
