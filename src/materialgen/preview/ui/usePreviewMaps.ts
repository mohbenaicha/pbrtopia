import { useEffect, useMemo, useState } from 'react';
import type { MapsState, PendingMaps } from '@mat/maps';
import { createPreviewMapLoader, PREVIEW_MAP_KINDS } from '../maps/createPreviewMapLoader';
import type { PreviewMaps } from '../material/previewMaps';

const NO_MAPS: PreviewMaps = {};
const NO_KEYS: Readonly<Record<string, string>> = {};
const NO_PENDING: PendingMaps = {};

/** The decoded maps, and the working key of each one that is decoded (preview R59 compares these with the keys a held tool view started from). */
export interface ShownPreviewMaps {
  maps: PreviewMaps;
  loaded: boolean;
  keys: Readonly<Record<string, string>>;
}

/**
 * Preview R19, R45, R48: the decoded working copies of the material's maps. Reloads only when a working key changes; a result that arrives after a newer
 * change is dropped. Until the first load finishes the preview shows the defaults of a material with no maps.
 */
export function usePreviewMaps(state: MapsState, readBlob: (key: string) => Promise<Blob | null>, pending: PendingMaps = NO_PENDING): ShownPreviewMaps {
  const loader = useMemo(() => createPreviewMapLoader(readBlob), [readBlob]);
  const [shown, setShown] = useState<ShownPreviewMaps>({ maps: NO_MAPS, loaded: false, keys: NO_KEYS });
  const signature = PREVIEW_MAP_KINDS.map((kind) => state.maps[kind]?.workingKey ?? '').join('|');

  useEffect(() => {
    let stale = false;
    const keys: Record<string, string> = {};
    for (const kind of PREVIEW_MAP_KINDS) {
      const key = state.maps[kind]?.workingKey;
      if (key !== undefined) keys[kind] = key;
    }
    for (const map of Object.values(pending)) loader.seed(map.workingKey, map.image); // preview R19: pictures already in the page need no read (maps R71)
    void loader.load(state).then((loaded) => {
      if (!stale) setShown({ maps: loaded, loaded: true, keys });
    });
    return () => {
      stale = true;
    };
  }, [loader, signature]); // `state` is read only through its working keys, which the signature carries; a pending picture comes with its key

  return shown;
}
