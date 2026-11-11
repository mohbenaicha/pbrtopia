// What the rest of the material app may use from storage (materialgen app R1, R30).
export type { MaterialProjectStore, NewMaterialProjectInput, SweepOutcome } from './MaterialProjectStore';
export { createMaterialStore, openMaterialStore, type MaterialStoreParts } from './createMaterialStore';
export {
  COLOR_MODES,
  DEFAULT_PRESET_ID,
  MATERIAL_SCHEMA_VERSION,
  MATERIAL_SIZES,
  newMaterialRecord,
  referencedBlobKeys,
  summarizeMaterial,
  type ColorMode,
  type MapRecord,
  type MapUndoEntry,
  type MaterialRecord,
  type MaterialSize,
} from './materialRecord';
export { INVALID_PROJECT, NEWER_VERSION, readMaterialRecord } from './readMaterialRecord';
export { readMaterialSettings, type MaterialSettingsRecord } from './materialSettings';
export { DEFAULT_PREVIEW_PREFS, DEFAULT_PREVIEW_VALUES, MESH_CHOICES, NORMAL_DIRECTIONS, readPreviewPrefs, readPreviewValues, type NormalDirection, type PreviewMesh, type PreviewPrefs, type PreviewValues } from './previewValues';
export { exportMaterialZip, type MaterialExportSource } from './zip/exportMaterialZip';
export { importMaterialZip } from './zip/importMaterialZip';
export type { MaterialImportTarget } from './zip/processMaterialZipEntry';
