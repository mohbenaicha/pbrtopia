import type { MapPlan, PlanIo } from './mapActions';
import { editMaps, placeMap, type MapEdit } from './mapOperations';
import type { DerivedFromRecord, MapsState } from './mapRecord';
import type { PixelImage } from './png/pngCodec';
import { encodePngBlob } from './png/pngOffThread';

/** What one masks operation changes in the maps: new labels, and/or a new bake of rough and metal (masks R31, R32, R47). */
export interface MasksCommit {
  labels?: {
    /** The decomposition picture at its own size, kept as the slot's original (model source); left out when the labels are their own original (working = original). */
    original?: PixelImage;
    /** Re-quantising a model's picture: the stored original stays as it is and only the working labels are replaced (masks R66). */
    keepOriginal?: boolean;
    working: PixelImage; // R8 labels at S
    derivedFrom: DerivedFromRecord; // the albedo working copy they were made from
  };
  bake?: { rough: PixelImage; metal: PixelImage };
  /**
   * The Height map under the height offsets (masks R82-R85), an edit of Height alone with its own undo entry: a new image computed from the base
   * `offsetBase` (an existing blob key, written down as the new working map's tag), or `backTo` the base's own key when the last offset returned to 0 (R84).
   */
  height?: { image: PixelImage; offsetBase: string } | { backTo: string };
  label: string; // the undo label of a later bake: Material masks
}

/**
 * Masks R31, R32, R47: the labels are placed (a derived cache with no undo entry, so a replacement never makes one); the first bake places rough
 * and metal as computed originals, every later bake edits both under the label (no group: maps R8, the card undoes both), which gives the Metal-Roughness slot its undo
 * entry. Both baked maps record the labels' new working file as their source, so they are stale exactly when the labels change.
 */
export async function planCommitMasks(state: MapsState, commit: MasksCommit, io: Pick<PlanIo, 'newKey'>): Promise<MapPlan> {
  const newBlobs = new Map<string, Blob>();
  let next = state;
  if (commit.labels !== undefined) {
    const { original, working, derivedFrom, keepOriginal } = commit.labels;
    const workingKey = io.newKey();
    newBlobs.set(workingKey, await encodePngBlob(working));
    let originalKey = workingKey;
    let width = working.width;
    let height = working.height;
    if (keepOriginal === true) {
      const existing = state.maps.labels;
      if (existing === undefined) throw new Error('There is no stored decomposition picture to keep');
      ({ originalKey, width, height } = existing);
    } else if (original !== undefined) {
      originalKey = io.newKey();
      newBlobs.set(originalKey, await encodePngBlob(original));
      ({ width, height } = original);
    }
    next = placeMap(next, 'labels', { originalKey, workingKey, width, height, derivedFrom, source: { kind: 'computed' } });
  }
  if (commit.bake !== undefined) {
    const labelsKey = next.maps.labels?.workingKey;
    if (labelsKey === undefined) throw new Error('A bake needs labels');
    const derivedFrom: DerivedFromRecord = { kind: 'labels', key: labelsKey };
    const replacing: MapEdit[] = [];
    for (const kind of ['rough', 'metal'] as const) {
      const image = commit.bake[kind];
      const key = io.newKey();
      newBlobs.set(key, await encodePngBlob(image));
      if (next.maps[kind] === undefined) next = placeMap(next, kind, { originalKey: key, workingKey: key, width: image.width, height: image.height, derivedFrom, source: { kind: 'computed' } });
      else replacing.push({ kind, workingKey: key, derivedFrom });
    }
    if (replacing.length > 0) next = editMaps(next, replacing, commit.label);
  }
  if (commit.height !== undefined) {
    if (next.maps.height === undefined) throw new Error('The height offsets need a Height map');
    if ('backTo' in commit.height) {
      next = editMaps(next, [{ kind: 'height', workingKey: commit.height.backTo }], commit.label);
    } else {
      const key = io.newKey();
      newBlobs.set(key, await encodePngBlob(commit.height.image));
      next = editMaps(next, [{ kind: 'height', workingKey: key, offsetBase: commit.height.offsetBase }], commit.label);
    }
  }
  return { next, newBlobs };
}
