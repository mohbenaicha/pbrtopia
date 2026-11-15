import { isStale, type MapKind, type MapsState } from '@mat/workerapi';
import { exportFileName, sanitiseExportName, type ExportKind, type ExportTarget } from '../names/exportNames';

export type ExportPacking = 'separate' | 'packed';

/** The choices of the export dialog (export R20, R21). */
export interface ExportOptions {
  target: ExportTarget;
  packing: ExportPacking;
  includeHeight: boolean;
  includeAo: boolean;
  includeMasks: boolean;
  /** R41: an authored emissive plane goes with the export; false or absent when there is none. */
  includeEmissive?: boolean;
  size: number; // the side written (R22)
}

export interface ExportInput {
  projectName: string;
  colorMode: 'albedo' | 'diffuse';
  state: MapsState;
  /** The material has a usable masks record (needed for masks.json, R23). */
  hasMasks: boolean;
}

export interface PlannedFile {
  kind: ExportKind;
  fileName: string;
  sizePx: number | null; // null for a JSON file
}

export interface ExportPlan {
  name: string; // the sanitised project name
  files: PlannedFile[];
  missing: ExportKind[]; // R24: maps with no working copy that this export would have written
  stale: ExportKind[]; // R27
  warnings: string[];
  /** Which maps feed the packed ORM, or null when none is written (R8). */
  orm: { ao: boolean; rough: boolean; metal: boolean } | null;
}

/** The six exported maps in file order, with the map kind of the record that holds each (export R31). */
const MAP_ORDER: ReadonlyArray<{ kind: ExportKind; stored: readonly MapKind[] }> = [
  { kind: 'albedo', stored: ['albedo', 'diffuse'] },
  { kind: 'normal', stored: ['normal'] },
  { kind: 'height', stored: ['height'] },
  { kind: 'roughness', stored: ['rough'] },
  { kind: 'metallic', stored: ['metal'] },
  { kind: 'ao', stored: ['ao'] },
];
const PACKED_KINDS: readonly ExportKind[] = ['roughness', 'metallic', 'ao'];
const NO_ALBEDO_WARNING = 'No albedo: the script builds the material without base colour';

/** The record's map kind that holds an exported kind in this material, or undefined when there is none. */
export function storedKindOf(state: MapsState, kind: ExportKind): MapKind | undefined {
  return MAP_ORDER.find((entry) => entry.kind === kind)?.stored.find((candidate) => state.maps[candidate] !== undefined);
}

/** Export R22: the sizes offered for a material of side S: S and every smaller size, never larger. */
export function exportSizeChoices(side: number): number[] {
  return [2048, 1024, 512, 256].filter((size) => size <= side);
}

/**
 * Export R3-R4, R8, R9, R21-R24, R27-R28, R41: the files an export with these choices writes, in zip order (maps in order, then the ORM, then the
 * extras), with the maps it could not write, the derived maps that are out of date and the warnings. Reads the record only.
 */
export function planExport(input: ExportInput, options: ExportOptions): ExportPlan {
  const { state, colorMode } = input;
  const name = sanitiseExportName(input.projectName);
  const included = (kind: ExportKind): boolean => (kind === 'height' ? options.includeHeight : kind === 'ao' ? options.includeAo : true);
  const files: PlannedFile[] = [];
  const missing: ExportKind[] = [];
  const stale: ExportKind[] = [];
  const add = (kind: ExportKind): void => void files.push({ kind, fileName: exportFileName(options.target, kind, name, colorMode), sizePx: kind === 'masks' ? null : options.size });

  const present = new Set<ExportKind>();
  for (const { kind } of MAP_ORDER) {
    if (!included(kind)) continue;
    const stored = storedKindOf(state, kind);
    if (stored === undefined) missing.push(kind);
    else {
      present.add(kind);
      if (kind !== 'albedo' && kind !== 'normal' && kind !== 'height' && isStale(state, stored)) stale.push(kind);
    }
  }

  for (const { kind } of MAP_ORDER) {
    if (!present.has(kind)) continue;
    if (options.packing === 'packed' && PACKED_KINDS.includes(kind)) continue;
    add(kind);
  }
  if (options.includeEmissive === true) add('emissive'); // R41: after ao, before the ORM; not a stored map, so never missing
  const orm = options.packing === 'packed' && PACKED_KINDS.some((kind) => present.has(kind)) ? { ao: present.has('ao'), rough: present.has('roughness'), metal: present.has('metallic') } : null;
  if (orm !== null) add('orm');
  if (options.includeMasks && state.maps.labels !== undefined && input.hasMasks) {
    add('labels');
    add('masks');
  }

  const warnings = !present.has('albedo') && files.length > 0 ? [NO_ALBEDO_WARNING] : [];
  return { name, files, missing, stale, warnings, orm };
}
