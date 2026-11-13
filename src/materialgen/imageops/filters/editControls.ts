// Imageops R14, R16, R17: the filter controls of every map kind (ids, ranges and defaults follow Materialize's texture edit table).

export const EDIT_MAP_KINDS = ['albedo', 'rough', 'metal', 'ao', 'height', 'normal'] as const;
export type EditMapKind = (typeof EDIT_MAP_KINDS)[number];

export const EDIT_CATEGORIES = ['tone', 'color', 'detail', 'surface', 'structure'] as const;
export type EditCategory = (typeof EDIT_CATEGORIES)[number];

export const CATEGORY_LABELS: Readonly<Record<EditCategory, string>> = { tone: 'Tone', color: 'Colour', detail: 'Detail', surface: 'Surface', structure: 'Structure' };

export interface EditControl {
  id: string;
  label: string;
  category: EditCategory;
  kind: 'slider' | 'toggle';
  min: number;
  max: number;
  step: number;
  defaultValue: number;
}

export type EditValues = Record<string, number>; // a toggle is 0 or 1

const ALL_BUT_ALBEDO: readonly EditMapKind[] = ['rough', 'metal', 'ao', 'height'];
const GREY_AND_ALBEDO: readonly EditMapKind[] = ['albedo', 'rough', 'metal', 'ao', 'height'];

interface ControlRow extends EditControl {
  maps: readonly EditMapKind[];
}

const slider = (id: string, label: string, category: EditCategory, min: number, max: number, defaultValue: number, step: number, maps: readonly EditMapKind[]): ControlRow =>
  ({ id, label, category, kind: 'slider', min, max, step, defaultValue, maps });
const toggle = (id: string, label: string, category: EditCategory, maps: readonly EditMapKind[]): ControlRow =>
  ({ id, label, category, kind: 'toggle', min: 0, max: 1, step: 1, defaultValue: 0, maps });

const ROWS: readonly ControlRow[] = [
  slider('exposure', 'Exposure', 'tone', -3, 3, 0, 0.01, GREY_AND_ALBEDO),
  slider('brightness', 'Brightness', 'tone', -1, 1, 0, 0.01, GREY_AND_ALBEDO),
  slider('contrast', 'Contrast', 'tone', 0.25, 4, 1, 0.01, GREY_AND_ALBEDO),
  slider('highlights', 'Highlights', 'tone', -1, 1, 0, 0.01, ['albedo']),
  slider('shadows', 'Shadows', 'tone', -1, 1, 0, 0.01, ['albedo']),
  slider('whites', 'Whites', 'tone', -1, 1, 0, 0.01, GREY_AND_ALBEDO),
  slider('blacks', 'Blacks', 'tone', -1, 1, 0, 0.01, GREY_AND_ALBEDO),
  slider('gamma', 'Gamma', 'tone', 0.2, 5, 1, 0.01, GREY_AND_ALBEDO),
  slider('hue', 'Hue', 'color', -180, 180, 0, 1, ['albedo']),
  slider('saturation', 'Saturation', 'color', 0, 3, 1, 0.01, ['albedo']),
  slider('chroma', 'Chroma', 'color', 0, 3, 1, 0.01, ['albedo']),
  slider('temperature', 'Temperature', 'color', -1, 1, 0, 0.01, ['albedo']),
  slider('tint', 'Tint', 'color', -1, 1, 0, 0.01, ['albedo']),
  slider('vibrance', 'Vibrance', 'color', -1, 1, 0, 0.01, ['albedo']),
  slider('sharpness', 'Sharpness', 'detail', 0, 2, 0, 0.05, GREY_AND_ALBEDO),
  slider('blur', 'Blur', 'detail', 0, 10, 0, 0.1, GREY_AND_ALBEDO),
  slider('clarity', 'Clarity', 'detail', -2, 2, 0, 0.1, GREY_AND_ALBEDO),
  slider('highpass', 'High pass', 'detail', 0, 5, 0, 0.1, ALL_BUT_ALBEDO),
  slider('denoise', 'Denoise', 'detail', 0, 3, 0, 0.1, EDIT_MAP_KINDS),
  slider('albedoMix', 'Colour mixin', 'detail', 0, 2, 0, 0.05, ['normal']), // R82: the albedo's brightness relief imprinted into the normal
  slider('levelsMin', 'Levels minimum', 'surface', 0, 1, 0, 0.01, GREY_AND_ALBEDO),
  slider('levelsMid', 'Levels midtones', 'surface', 0.1, 10, 1, 0.01, GREY_AND_ALBEDO),
  slider('levelsMax', 'Levels maximum', 'surface', 0, 1, 1, 0.01, GREY_AND_ALBEDO),
  toggle('invert', 'Invert', 'surface', ALL_BUT_ALBEDO),
  toggle('normalize', 'Normalise', 'surface', ALL_BUT_ALBEDO),
  slider('heightIntensity', 'Height intensity', 'surface', 0, 3, 1, 0.01, ['height']),
  slider('roughnessBias', 'Roughness bias', 'surface', -0.5, 0.5, 0, 0.01, ['rough']),
  slider('metallicBias', 'Metallic bias', 'surface', -0.5, 0.5, 0, 0.01, ['metal']),
  slider('histogramRemap', 'Histogram remap', 'structure', 0.1, 3, 1, 0.01, GREY_AND_ALBEDO),
  slider('contrastLow', 'Contrast, large scale', 'structure', 0, 4, 1, 0.1, ALL_BUT_ALBEDO),
  slider('contrastMid', 'Contrast, medium scale', 'structure', 0, 4, 1, 0.1, ALL_BUT_ALBEDO),
  slider('contrastHigh', 'Contrast, fine scale', 'structure', 0, 4, 1, 0.1, ALL_BUT_ALBEDO),
  slider('edgeEmphasis', 'Edge emphasis', 'structure', 0, 5, 0, 0.1, ['height']),
];

const controlsOfKind = (kind: EditMapKind): readonly EditControl[] => ROWS.filter((row) => row.maps.includes(kind)).map((row) => ({ id: row.id, label: row.label, category: row.category, kind: row.kind, min: row.min, max: row.max, step: row.step, defaultValue: row.defaultValue }));

const CONTROLS_BY_KIND: Readonly<Record<EditMapKind, readonly EditControl[]>> = {
  albedo: controlsOfKind('albedo'),
  rough: controlsOfKind('rough'),
  metal: controlsOfKind('metal'),
  ao: controlsOfKind('ao'),
  height: controlsOfKind('height'),
  normal: controlsOfKind('normal'),
};

/** The controls a map kind shows, in table order (grouped by category in the order of EDIT_CATEGORIES). */
export function controlsFor(kind: EditMapKind): readonly EditControl[] {
  return CONTROLS_BY_KIND[kind];
}

/** The map kind a filter treats a stored map as: a diffuse map is edited as albedo; labels are never edited. */
export function editKindOf(kind: string): EditMapKind | null {
  if (kind === 'diffuse') return 'albedo';
  return (EDIT_MAP_KINDS as readonly string[]).includes(kind) ? (kind as EditMapKind) : null; // labels, and anything unknown, are not edited
}

export function createDefaultEditValues(kind: EditMapKind): EditValues {
  return Object.fromEntries(controlsFor(kind).map((control) => [control.id, control.defaultValue]));
}

/** False exactly when every control the map kind shows is at its default (R16). */
export function hasAnyChanges(kind: EditMapKind, values: EditValues): boolean {
  return controlsFor(kind).some((control) => (values[control.id] ?? control.defaultValue) !== control.defaultValue);
}

/** A typed or dragged value kept inside the control's range; a value that is not a number becomes the default. */
export function clampControlValue(control: EditControl, value: number): number {
  if (Number.isNaN(value)) return control.defaultValue;
  return Math.min(control.max, Math.max(control.min, value));
}

export function clampEditValue(kind: EditMapKind, id: string, value: number): number {
  const control = controlsFor(kind).find((candidate) => candidate.id === id);
  return control ? clampControlValue(control, value) : value;
}
