import type { ProjectSummary, RawRecord } from '@shared/projects';
import { MATERIAL_SIZES, type DerivedFromRecord, type MapKind, type MapRecord, type MapUndoEntry, type MaterialSize } from '@mat/maps';
import { DEFAULT_PREVIEW_VALUES, type PreviewValues } from './previewValues';

// What a material project remembers, as JSON (app R26). No field holds image data; maps point at files by key.

export const MATERIAL_SCHEMA_VERSION = 1;
export const DEFAULT_PRESET_ID = 'preset-1';

export { MATERIAL_SIZES };
export type { DerivedFromRecord, MapRecord, MapUndoEntry, MaterialSize };
export const COLOR_MODES = ['albedo', 'diffuse'] as const;
export type ColorMode = (typeof COLOR_MODES)[number];

export interface MaterialRecord {
  schemaVersion: number;
  id: string;
  name: string;
  createdAt: string;
  updatedAt: string;
  thumbnailKey?: string;
  partlyDeleted?: true; // set when deleting could not remove every file (app R35); deleting again finishes the job
  kind: 'texture';
  size: MaterialSize | null; // null until the first image is placed
  colorMode: ColorMode;
  prompt: string;
  referenceImages: string[]; // blob keys
  presetId: string;
  customPlan?: RawRecord; // typed by the generation wave
  maps: Partial<Record<MapKind, MapRecord>>;
  masks?: RawRecord; // typed by the masks wave
  aoParams?: RawRecord; // typed by the imageops wave
  preview: PreviewValues;
}

export interface NewMaterialInput {
  id: string;
  name: string;
  size: MaterialSize | null;
  now: string;
}

export function newMaterialRecord({ id, name, size, now }: NewMaterialInput): MaterialRecord {
  return {
    schemaVersion: MATERIAL_SCHEMA_VERSION,
    id,
    name,
    createdAt: now,
    updatedAt: now,
    kind: 'texture',
    size,
    colorMode: 'albedo',
    prompt: '',
    referenceImages: [],
    presetId: DEFAULT_PRESET_ID,
    maps: {},
    preview: { ...DEFAULT_PREVIEW_VALUES },
  };
}

/** What the project list shows: kind and size in `detail`, no triangle count (app R23a). */
export function summarizeMaterial(record: MaterialRecord): ProjectSummary {
  const size = record.size === null ? 'Size not set' : `${record.size} px`;
  const detail = record.partlyDeleted ? 'Partly deleted' : `Texture · ${size}`;
  const summary: ProjectSummary = { id: record.id, name: record.name, updatedAt: record.updatedAt, detail };
  if (record.thumbnailKey !== undefined) summary.thumbnailKey = record.thumbnailKey;
  return summary;
}

/** Every blob key some field of the record points at, once each; the thumbnail is not among them. */
export function referencedBlobKeys(record: MaterialRecord): Set<string> {
  const keys = new Set<string>(record.referenceImages);
  for (const map of Object.values(record.maps)) {
    keys.add(map.originalKey);
    keys.add(map.workingKey);
    if (map.undoKey !== null) keys.add(map.undoKey);
  }
  return keys;
}
