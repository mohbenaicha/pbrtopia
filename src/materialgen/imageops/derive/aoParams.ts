import type { EditControl, EditValues } from '../filters/editControls';

// Imageops R41-R43: the parameters of the two ways to make an AO map, in the same control shape the filter dialog draws.

export type AoSource = 'height' | 'normal';

const slider = (id: string, label: string, min: number, max: number, defaultValue: number, step: number): EditControl =>
  ({ id, label, category: 'surface', kind: 'slider', min, max, step, defaultValue });

const CONTROLS: Readonly<Record<AoSource, readonly EditControl[]>> = {
  height: [slider('depth', 'Depth', 0.1, 12, 2.4, 0.1), slider('strength', 'Strength', 0.6, 1.8, 0.96, 0.01), slider('spread', 'Spread', 8, 80, 40, 1)],
  normal: [slider('spread', 'Spread', 8, 80, 50, 1), slider('power', 'Power', 0.25, 4, 1, 0.05), slider('bias', 'Bias', -0.5, 0.5, 0, 0.01)],
};

export const aoControlsFor = (source: AoSource): readonly EditControl[] => CONTROLS[source];

export const createDefaultAoValues = (source: AoSource): EditValues => Object.fromEntries(CONTROLS[source].map((control) => [control.id, control.defaultValue]));

export const hasAoChanges = (source: AoSource, values: EditValues): boolean =>
  CONTROLS[source].some((control) => (values[control.id] ?? control.defaultValue) !== control.defaultValue);

/** R42: Height unless only a normal map exists, or the user chose Normal and one exists; null when neither exists. */
export function aoSourceFor(available: { hasHeight: boolean; hasNormal: boolean }, chosen: AoSource | undefined): AoSource | null {
  if (chosen === 'normal' && available.hasNormal) return 'normal';
  if (available.hasHeight) return 'height';
  return available.hasNormal ? 'normal' : null;
}
