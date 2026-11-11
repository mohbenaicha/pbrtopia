import { changeSize, editMaps, isOriginalRestored, placeMap, restoreOriginal, type MapEdit } from './mapOperations';
import type { MapKind } from './mapKinds';
import type { DerivedFromRecord, MapsState, MaterialSize } from './mapRecord';
import type { PixelImage } from './png/pngCodec';
import { encodePngBlob } from './png/pngOffThread';
import { readMapPixels } from './readMapPixels';
import { resizeToSquareBlob, type GpuResizer } from './resizeToSquareBlob';

// The actions that must read stored maps before they can change the record: Restore original (R19) and a change of S (R21).
// Each returns the next state and the files to write; the caller commits them (commitMapOperation).

export interface PlanIo {
  readBlob(key: string): Promise<Blob | null>;
  newKey(): string;
  /** The name the person sees for a map (Diffuse, Roughness), for messages. */
  label(kind: MapKind): string;
  resize?: GpuResizer;
}

export interface MapPlan {
  next: MapsState;
  newBlobs: Map<string, Blob>;
}

export type PlanResult = { ok: true; plan: MapPlan } | { ok: false; message: string };

/** A map an imageops result replaces; `derivedFrom` is set for a computed map (AO) and says which map it was made from. */
export interface ImageEdit {
  kind: MapKind;
  image: PixelImage;
  derivedFrom?: DerivedFromRecord;
}

/**
 * R16, R44, R70: each result becomes a new working file with its own undo entry (an existing map), or a new computed original (an empty slot).
 * `grouped` ties the entries of a geometry operation together.
 */
export async function planApplyEdits(state: MapsState, edits: readonly ImageEdit[], label: string, grouped: boolean, io: Pick<PlanIo, 'newKey'>): Promise<PlanResult> {
  if (edits.length === 0) return { ok: true, plan: { next: state, newBlobs: new Map() } };
  const newBlobs = new Map<string, Blob>();
  const replacing: MapEdit[] = [];
  let next = state;
  for (const edit of edits) {
    const key = io.newKey();
    newBlobs.set(key, await encodePngBlob(edit.image));
    if (state.maps[edit.kind] !== undefined) {
      replacing.push(edit.derivedFrom === undefined ? { kind: edit.kind, workingKey: key } : { kind: edit.kind, workingKey: key, derivedFrom: edit.derivedFrom });
    } else {
      next = placeMap(next, edit.kind, {
        originalKey: key, workingKey: key, width: edit.image.width, height: edit.image.height, source: { kind: 'computed' },
        ...(edit.derivedFrom === undefined ? {} : { derivedFrom: edit.derivedFrom }),
      });
    }
  }
  if (replacing.length > 0) next = editMaps(next, replacing, label, grouped ? { groupId: io.newKey() } : undefined);
  return { ok: true, plan: { next, newBlobs } };
}

/** R19: the working map becomes the original again; the original's own file when it is S x S, else a resampled copy. */
export async function planRestoreOriginal(state: MapsState, kind: MapKind, io: PlanIo): Promise<PlanResult> {
  const map = state.maps[kind];
  if (map === undefined || state.size === null || isOriginalRestored(map)) return { ok: true, plan: { next: state, newBlobs: new Map() } };
  const original = await readMapPixels(await io.readBlob(map.originalKey));
  if (original === null) return { ok: false, message: `${io.label(kind)}: the original file cannot be read.` };
  if (original.width === state.size && original.height === state.size) return { ok: true, plan: { next: restoreOriginal(state, kind), newBlobs: new Map() } };
  const key = io.newKey();
  return { ok: true, plan: { next: restoreOriginal(state, kind, key), newBlobs: new Map([[key, await resizeToSquareBlob(original, kind, state.size, io.resize)]]) } };
}

/** R21: every working map is resampled to the new S into a new file; one group ties the undo entries together. */
export async function planChangeSize(state: MapsState, size: MaterialSize, io: PlanIo): Promise<PlanResult> {
  if (state.size === size) return { ok: true, plan: { next: state, newBlobs: new Map() } };
  const keys: Partial<Record<MapKind, string>> = {};
  const newBlobs = new Map<string, Blob>();
  for (const kind of Object.keys(state.maps) as MapKind[]) {
    const map = state.maps[kind]!;
    if (kind === 'labels') {
      keys[kind] = map.workingKey; // the label image is requantised from its original by the masks step; it is not resampled here
      continue;
    }
    const pixels = await readMapPixels(await io.readBlob(map.workingKey));
    if (pixels === null) return { ok: false, message: `${io.label(kind)}: the file cannot be read.` };
    const key = io.newKey();
    keys[kind] = key;
    newBlobs.set(key, await resizeToSquareBlob(pixels, kind, size, io.resize));
  }
  return { ok: true, plan: { next: changeSize(state, size, keys, io.newKey()), newBlobs } };
}
