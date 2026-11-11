import type { MapKind } from './mapKinds';
import type { MapsState } from './mapRecord';
import type { PixelImage } from './png/pngCodec';

/** Maps R71: a picture the preview may show before it is saved: the working key it will have and its S x S pixels. */
export interface PendingMap {
  workingKey: string;
  image: PixelImage;
}

export type PendingMaps = Partial<Record<MapKind, PendingMap>>;

/** Maps R71: the maps as the preview should draw them while pictures are pending; the very same state when none is. */
export function withPendingMaps(state: MapsState, pending: PendingMaps): MapsState {
  const kinds = Object.keys(pending) as MapKind[];
  if (kinds.length === 0) return state;
  const maps = { ...state.maps };
  for (const kind of kinds) {
    const { workingKey, image } = pending[kind]!;
    const existing = maps[kind];
    maps[kind] = existing === undefined
      ? { originalKey: workingKey, workingKey, undoKey: null, width: image.width, height: image.height }
      : { ...existing, workingKey };
  }
  return { ...state, maps };
}
