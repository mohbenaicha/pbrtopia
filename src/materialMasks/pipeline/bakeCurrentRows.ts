import type { Edges } from '../edges';
import type { PixelImage } from '../imageTypes';
import { bakeMasks } from '../bake/bakeMasks';
import { dilateGutter } from '../bake/dilateGutter';
import { rowsToBake } from '../record/maskRows';
import type { MasksRecord } from '../record/masksRecord';

export interface BakedMaps {
  rough: PixelImage;
  metal: PixelImage;
}

/** Everything a masks operation puts into the project: the labels, the record and the baked maps. */
export interface MasksBuild {
  labels: PixelImage;
  record: MasksRecord;
  bake: BakedMaps;
}

/** Masks R50, R54, R91: the two maps for the labels with the rows and the feather the record has now; `grey` is the albedo's, for the rows with the Colour mixin on. `base` and `keep`: mask-mode R14 (a texel with no mask, or under a hidden triangle, keeps the base pixel). */
export function bakeCurrentRows(labels: PixelImage, record: MasksRecord, grey?: PixelImage, edges?: Edges, base?: BakedMaps, keep?: Uint8Array, coverage?: Uint8Array): BakedMaps {
  const baked = bakeBaseRows(labels, record, grey, edges, base, keep);
  return coverage === undefined ? baked : dilateGutter(baked, coverage); // mask-mode R28: the gutter is recomputed from this bake's result
}

function bakeBaseRows(labels: PixelImage, record: MasksRecord, grey?: PixelImage, edges?: Edges, base?: BakedMaps, keep?: Uint8Array): BakedMaps {
  return bakeMasks({ labels, rows: rowsToBake(record.rows), feather: record.feather, ...(grey === undefined ? {} : { grey }), ...(edges === undefined ? {} : { edges }), ...(base === undefined ? {} : { base }), ...(keep === undefined ? {} : { keep }) });
}
