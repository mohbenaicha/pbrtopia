import { MAX_RECORD_COLOURS, paletteForRecord, parseMasksRecord, type MasksRecord } from '../../materialMasks';
import { FieldProblem, readBlobKey, readCount, readList, readNonEmptyText, readNumber, readObject } from './fieldReaders';
import { MIN_MASK_COMPONENTS, readComponentId } from './maskPlanRecord';

/** The one set of material masks a project keeps (mask-mode data model). The labels are a file; the rows, palette and feather are the core's record. */
export interface ProjectMasksRecord {
  setId: string; // the latest mask set baked into it (it may no longer exist)
  albedoPictureId: string | null; // the albedo the latest bake was painted from (copied from the set's plan; null: the model's own albedo): the stale check and the colour mixin use it
  size: number; // side of the labels file, 1024 to 4096
  labelsBlobKey: string; // masks/<id>.png
  roughPictureId: string | null; // owned pictures; null when the user deleted one
  metalPictureId: string | null;
  componentIds: string[]; // one per row, in label order (mask-mode R27)
  core: MasksRecord; // source 'model', palette, feather, rows (height is 0: projection masks have none)
  createdAt: number;
}

export const MIN_MASKS_SIZE = 1024;
export const MAX_MASKS_SIZE = 4096;
export const MASKS_PREFIX = 'masks/';

export const masksBlobKey = (labelsId: string): string => `${MASKS_PREFIX}${labelsId}.png`;

const readOwnedPicture = (value: unknown, path: string): string | null => (value === null || value === undefined ? null : readNonEmptyText(value, path));

/** mask-mode R22: the ids of a record from before ids existed are `<setId>#<label>`. */
function readComponentIds(value: unknown, path: string, setId: string, rows: number): string[] {
  if (value === undefined) return Array.from({ length: rows }, (_, label) => `${setId}#${label}`);
  const ids = readList(value, path, readComponentId);
  if (ids.length !== rows || new Set(ids).size !== ids.length) throw new FieldProblem(path);
  return ids;
}

/** Strict: a bad field, a size outside 1024..4096, a key outside `masks/`, rows outside 2..32, a palette that is not the record palette's first N entries, or ids that do not match the rows is a FieldProblem. */
export function readProjectMasks(value: unknown, path: string): ProjectMasksRecord {
  const raw = readObject(value, path);
  const size = readCount(raw['size'], `${path}.size`, MIN_MASKS_SIZE);
  if (size > MAX_MASKS_SIZE) throw new FieldProblem(`${path}.size`);
  const labelsBlobKey = readBlobKey(raw['labelsBlobKey'], `${path}.labelsBlobKey`);
  if (!labelsBlobKey.startsWith(MASKS_PREFIX)) throw new FieldProblem(`${path}.labelsBlobKey`);
  const core = parseMasksRecord(raw['core'], MAX_RECORD_COLOURS);
  if (core === null || core.palette.length !== core.rows.length || core.rows.length < MIN_MASK_COMPONENTS || core.rows.length > MAX_RECORD_COLOURS) throw new FieldProblem(`${path}.core`);
  const shared = paletteForRecord(core.palette.length);
  if (!core.palette.every((entry, k) => entry.label === k && entry.hex === shared[k]?.hex)) throw new FieldProblem(`${path}.core.palette`);
  const setId = readNonEmptyText(raw['setId'], `${path}.setId`);
  return {
    setId,
    albedoPictureId: readOwnedPicture(raw['albedoPictureId'], `${path}.albedoPictureId`),
    size,
    labelsBlobKey,
    roughPictureId: readOwnedPicture(raw['roughPictureId'], `${path}.roughPictureId`),
    metalPictureId: readOwnedPicture(raw['metalPictureId'], `${path}.metalPictureId`),
    componentIds: readComponentIds(raw['componentIds'], `${path}.componentIds`, setId, core.rows.length),
    core,
    createdAt: readNumber(raw['createdAt'], `${path}.createdAt`),
  };
}
