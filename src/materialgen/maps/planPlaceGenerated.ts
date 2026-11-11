import type { MapKind } from './mapKinds';
import type { MapsState } from './mapRecord';
import type { MapPlan } from './mapActions';
import { nearestMaterialSize } from './mapOperations';
import { placeNativeImage } from './placeNativeImage';
import { convertToSlotFormat, pixelFormatOfKind } from './pixels/convertToSlotFormat';
import type { PixelImage } from './png/pngCodec';
import type { GpuResizer } from './resizeToSquareBlob';

/** One cut tile of a generated image on its way to being a map's original. */
export interface GeneratedMap {
  kind: MapKind;
  image: PixelImage;
}

/**
 * Maps R12-R15, generation R40, R42: generated maps become the originals of their slots in one plan (all or none). Each image is converted to its slot's format (Height
 * to one grey channel); S is taken from the first image when the material has none (R15); a regenerate over a map with an original replaces it and clears its undo (R13, R14).
 */
export async function planPlaceGenerated(state: MapsState, generated: readonly GeneratedMap[], newKey: () => string, resize?: GpuResizer): Promise<MapPlan> {
  const first = generated[0];
  let next: MapsState = first === undefined || state.size !== null ? state : { ...state, size: nearestMaterialSize(Math.max(first.image.width, first.image.height)) };
  const newBlobs = new Map<string, Blob>();
  for (const { kind, image } of generated) {
    const native = convertToSlotFormat(image, pixelFormatOfKind(kind));
    next = await placeNativeImage({ state: next, kind, native, source: { kind: 'generated' }, newKey, newBlobs, ...(resize === undefined ? {} : { resize }) });
  }
  return { next, newBlobs };
}
