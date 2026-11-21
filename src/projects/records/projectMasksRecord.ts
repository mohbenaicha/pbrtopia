import { MAX_COMPONENTS, parseMasksRecord, type MasksRecord } from '../../materialMasks';
import { FieldProblem, readBlobKey, readCount, readNonEmptyText, readNumber, readObject } from './fieldReaders';
import { MIN_MASK_COMPONENTS } from './maskPlanRecord';

/** The one set of material masks a project keeps (mask-mode data model). The labels are a file; the rows, palette and feather are the core's record. */
export interface ProjectMasksRecord {
  setId: string; // the mask set it was baked from (it may no longer exist)
  albedoPictureId: string; // the albedo the masks were painted from (copied from the set's plan): the stale check and the colour mixin use it
  size: number; // side of the labels file, 1024 to 4096
  labelsBlobKey: string; // masks/<id>.png
  roughPictureId: string | null; // owned pictures; null when the user deleted one
  metalPictureId: string | null;
  core: MasksRecord; // source 'model', palette, feather, rows (height is 0: projection masks have none)
  createdAt: number;
}

export const MIN_MASKS_SIZE = 1024;
export const MAX_MASKS_SIZE = 4096;
export const MASKS_PREFIX = 'masks/';

export const masksBlobKey = (labelsId: string): string => `${MASKS_PREFIX}${labelsId}.png`;

const readOwnedPicture = (value: unknown, path: string): string | null => (value === null || value === undefined ? null : readNonEmptyText(value, path));

/** Strict: a bad field, a size outside 1024..4096, a key outside `masks/`, or a core of 1 or 11 materials (or palette and rows of different lengths) is a FieldProblem. */
export function readProjectMasks(value: unknown, path: string): ProjectMasksRecord {
  const raw = readObject(value, path);
  const size = readCount(raw['size'], `${path}.size`, MIN_MASKS_SIZE);
  if (size > MAX_MASKS_SIZE) throw new FieldProblem(`${path}.size`);
  const labelsBlobKey = readBlobKey(raw['labelsBlobKey'], `${path}.labelsBlobKey`);
  if (!labelsBlobKey.startsWith(MASKS_PREFIX)) throw new FieldProblem(`${path}.labelsBlobKey`);
  const core = parseMasksRecord(raw['core']);
  if (core === null || core.palette.length !== core.rows.length || core.rows.length < MIN_MASK_COMPONENTS || core.rows.length > MAX_COMPONENTS) throw new FieldProblem(`${path}.core`);
  return {
    setId: readNonEmptyText(raw['setId'], `${path}.setId`),
    albedoPictureId: readNonEmptyText(raw['albedoPictureId'], `${path}.albedoPictureId`),
    size,
    labelsBlobKey,
    roughPictureId: readOwnedPicture(raw['roughPictureId'], `${path}.roughPictureId`),
    metalPictureId: readOwnedPicture(raw['metalPictureId'], `${path}.metalPictureId`),
    core,
    createdAt: readNumber(raw['createdAt'], `${path}.createdAt`),
  };
}
