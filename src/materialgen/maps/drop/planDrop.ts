import { editMaps, nearestMaterialSize } from '../mapOperations';
import { placeNativeImage } from '../placeNativeImage';
import type { MapKind } from '../mapKinds';
import type { MapsState, MaterialSize } from '../mapRecord';
import { convertToSlotFormat, pixelFormatOfKind } from '../pixels/convertToSlotFormat';
import type { PixelImage } from '../png/pngCodec';
import type { PendingMap } from '../pendingMaps';
import { resizeToSquareBlob, type GpuResizer } from '../resizeToSquareBlob';

export const MAX_DROP_SIDE = 8192;

export interface DropRequest {
  state: MapsState;
  kind: MapKind;
  /** The decoded file, as it came (any channel count). */
  image: PixelImage;
  fileName: string;
  /** A fresh blob key for each file the drop writes. */
  newKey(): string;
  resize?: GpuResizer;
  /** Maps R71: gets the new working picture as soon as its S x S pixels exist, before it is encoded. */
  onPending?: (pending: PendingMap) => void;
}

/** The record change and the files to write for one accepted drop (maps R36-R39). */
export interface DropPlan {
  next: MapsState;
  newBlobs: Map<string, Blob>;
}

export type DropOutcome = { ok: true; plan: DropPlan } | { ok: false; message: string };

/**
 * R17, R35-R39: a dropped image on an empty slot is a place (original at native size, S set from it when unset); on a slot with a working map
 * it is an edit that replaces the working map and keeps the original. The working map is always S x S (non-square images are stretched, R39).
 */
export async function planDrop({ state, kind, image, fileName, newKey, resize, onPending }: DropRequest): Promise<DropOutcome> {
  if (kind === 'labels') return { ok: false, message: 'The decomposition accepts no dropped image.' };
  if (Math.max(image.width, image.height) > MAX_DROP_SIDE) return { ok: false, message: 'Image too large' };
  const native = convertToSlotFormat(image, pixelFormatOfKind(kind));
  const size: MaterialSize = state.size ?? nearestMaterialSize(Math.max(native.width, native.height));
  const newBlobs = new Map<string, Blob>();

  if (state.maps[kind] !== undefined) {
    const workingKey = newKey();
    newBlobs.set(workingKey, await resizeToSquareBlob(native, kind, size, resize, (image) => onPending?.({ workingKey, image })));
    return { ok: true, plan: { next: editMaps({ ...state, size }, [{ kind, workingKey, derivedFrom: null }], 'Drop'), newBlobs } };
  }

  const placed = await placeNativeImage({ state: { ...state, size }, kind, native, source: { kind: 'dropped', name: fileName }, newKey, newBlobs, ...(resize === undefined ? {} : { resize }), ...(onPending === undefined ? {} : { onPending }) });
  return { ok: true, plan: { next: placed, newBlobs } };
}
