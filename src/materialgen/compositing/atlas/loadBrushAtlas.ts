import atlasUrl from './brush_atlas.png?url';
import { BRUSH_ATLAS_ERROR, readBrushAtlas, type BrushAtlas } from './readBrushAtlas';

/** The atlas picture's address, for the pickers' tiles (a CSS background cut to one shape). */
export const BRUSH_ATLAS_URL: string = atlasUrl;

let loading: Promise<BrushAtlas> | null = null;

/** Compositing R36: the shipped brush atlas, fetched and decoded once (a failure is not remembered, so a later try can succeed). */
export function loadBrushAtlas(): Promise<BrushAtlas> {
  if (loading === null) {
    loading = fetch(atlasUrl)
      .then(async (response) => {
        if (!response.ok) throw new Error(BRUSH_ATLAS_ERROR);
        return readBrushAtlas(new Uint8Array(await response.arrayBuffer()));
      })
      .catch(() => {
        loading = null;
        throw new Error(BRUSH_ATLAS_ERROR);
      });
  }
  return loading;
}
