import type { MapsState } from '@mat/maps';
import { readMapPixels, type PixelImage } from '@mat/workerapi';
import type { PreviewMaps } from '../material/previewMaps';

export const PREVIEW_MAP_KINDS = ['albedo', 'normal', 'height', 'ao', 'rough', 'metal', 'labels'] as const;

export interface PreviewMapLoader {
  load(state: MapsState): Promise<PreviewMaps>; // the decoded working copy of every map the preview draws
  /** Maps R71: a picture already in the page for a working key, so a load of that key reads and decodes no file. */
  seed(key: string, picture: PixelImage): void;
}

/**
 * Preview R19, R45, R48: decodes working copies for the preview and keeps each decoded picture while its working key is still the map's, so a change to
 * one map reads and decodes only that map and the others keep the very same picture (the material compares them by identity). A file that is missing or
 * will not decode counts as a missing map: the mesh shows that map's default, never an error or a blank mesh.
 */
export function createPreviewMapLoader(readBlob: (key: string) => Promise<Blob | null>): PreviewMapLoader {
  const decoded = new Map<string, PixelImage>(); // by working key; only pictures that decoded

  return {
    seed(key, picture) {
      decoded.set(key, picture);
    },
    async load(state) {
      const wanted = new Map<(typeof PREVIEW_MAP_KINDS)[number], string>();
      for (const kind of PREVIEW_MAP_KINDS) {
        const record = state.maps[kind];
        if (record !== undefined) wanted.set(kind, record.workingKey);
      }
      const keys = new Set(wanted.values());
      for (const key of decoded.keys()) if (!keys.has(key)) decoded.delete(key);
      await Promise.all(
        [...keys].filter((key) => !decoded.has(key)).map(async (key) => {
          let picture: PixelImage | null = null;
          try {
            picture = await readMapPixels(await readBlob(key));
          } catch {
            // a failed read or decode is a missing map...
          }
          if (picture) decoded.set(key, picture); // ...and is not remembered, so the next load tries again
        }),
      );
      const maps: PreviewMaps = {};
      for (const [kind, key] of wanted) {
        const picture = decoded.get(key);
        if (picture) maps[kind] = picture;
      }
      return maps;
    },
  };
}
