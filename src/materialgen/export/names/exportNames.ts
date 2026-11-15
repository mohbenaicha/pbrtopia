/** The things an export can write: the six maps, the authored emissive map, the packed ORM and the labels (export R3, R23, R41). */
export type ExportKind = 'albedo' | 'normal' | 'height' | 'roughness' | 'metallic' | 'ao' | 'emissive' | 'orm' | 'labels' | 'masks';
export type ExportTarget = 'blender' | 'maya' | 'substance' | 'generic';

const MAX_NAME_LENGTH = 120; // proposal (export R1)
const DEVICE_NAME = /^(con|prn|aux|nul|com[1-9]|lpt[1-9])$/i;

const stripTrailing = (text: string): string => text.replace(/[. ]+$/, '');

/** Export R1: the project name as a safe file name part. */
export function sanitiseExportName(projectName: string): string {
  const replaced = projectName
    .trim()
    .replace(/[\\/:*?"<>|\u0000-\u001f]/g, '_')
    .replace(/\s+/g, ' ');
  const noDots = stripTrailing(replaced).replace(/\.{2,}/g, '_'); // trailing dots go first, then no ".." is left inside (R2)
  const cut = stripTrailing(Array.from(noDots).slice(0, MAX_NAME_LENGTH).join('')); // by code points, so a pair is never cut in half
  const named = cut === '' ? 'Untitled' : cut;
  return DEVICE_NAME.test(named) ? `_${named}` : named;
}

/** Export R4: the Substance Painter suffixes, one table. */
export const EXPORT_FILE_SUFFIXES: Readonly<Record<ExportKind, string>> = {
  albedo: 'BaseColor',
  normal: 'Normal',
  height: 'Height',
  roughness: 'Roughness',
  metallic: 'Metallic',
  ao: 'AmbientOcclusion',
  emissive: 'Emissive',
  orm: 'ORM',
  labels: 'Labels',
  masks: 'Masks',
};

/** Export R3, R4: the file a kind is written to for a target; `name` is already sanitised. */
export function exportFileName(target: ExportTarget, kind: ExportKind, name: string, colorMode: 'albedo' | 'diffuse'): string {
  const extension = kind === 'masks' ? 'json' : 'png'; // masks.json (R23); everything else is a PNG
  if (target === 'substance') return `${name}_${EXPORT_FILE_SUFFIXES[kind]}.${extension}`;
  return `${kind === 'albedo' ? colorMode : kind}.${extension}`;
}
