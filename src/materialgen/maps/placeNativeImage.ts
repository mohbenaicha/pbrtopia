import type { MapKind } from './mapKinds';
import type { MapSource, MapsState, MaterialSize } from './mapRecord';
import { placeMap } from './mapOperations';
import type { PendingMap } from './pendingMaps';
import type { PixelImage } from './png/pngCodec';
import { encodePngBlob } from './png/pngOffThread';
import { resizeToSquareBlob, type GpuResizer } from './resizeToSquareBlob';

export interface NativePlacement {
  state: MapsState; // its size is already set
  kind: MapKind;
  native: PixelImage; // already in the slot's format
  source: MapSource;
  newKey(): string;
  newBlobs: Map<string, Blob>; // receives the files this place writes
  resize?: GpuResizer;
  /** Maps R71: gets the working picture, with its key, as soon as its S x S pixels exist, before anything is encoded for it. */
  onPending?: (pending: PendingMap) => void;
}

/**
 * Maps R12, R35-R39: the image becomes the map's original at native size; the working copy is the same file when it is already S x S, else a copy resampled to S x S.
 * Drop (onto an empty slot) and generation (empty slot or confirmed regenerate) place the same way.
 */
export async function placeNativeImage({ state, kind, native, source, newKey, newBlobs, resize, onPending }: NativePlacement): Promise<MapsState> {
  const size: MaterialSize = state.size!;
  const originalKey = newKey();
  let workingKey = originalKey;
  if (native.width !== size || native.height !== size) {
    workingKey = newKey();
    // the working copy goes first: its pixels are what the preview waits for (maps R71)
    newBlobs.set(workingKey, await resizeToSquareBlob(native, kind, size, resize, (image) => onPending?.({ workingKey, image })));
  } else {
    onPending?.({ workingKey, image: native });
  }
  newBlobs.set(originalKey, await encodePngBlob(native)); // maps R60: large pictures are encoded in a worker
  return placeMap(state, kind, { originalKey, workingKey, width: native.width, height: native.height, source });
}
