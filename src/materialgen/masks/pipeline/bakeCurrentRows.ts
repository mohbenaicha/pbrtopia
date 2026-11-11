import type { PixelImage } from '@mat/workerapi';
import { bakeMasks } from '../bake/bakeMasks';
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

/** Masks R50, R54: the two maps for the labels with the rows and the feather the record has now. */
export function bakeCurrentRows(labels: PixelImage, record: MasksRecord): BakedMaps {
  return bakeMasks({ labels, rows: rowsToBake(record.rows), feather: record.feather });
}
