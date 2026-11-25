import { MAX_FEATHER, toByte, type BakeRow } from './bakeMasks';
import { MIX_SENSITIVITY } from './colourMixin';

export type MapName = 'rough' | 'metal';

export interface BakedFrom {
  rows: readonly BakeRow[];
  feather: number;
}

export interface ChangedBake {
  maps: MapName[]; // never empty
  labels: number[] | 'all'; // the rows (labels) whose table value or grain differs for a named map; 'all' for a feather change, a different row count, or every label
}

const radiusOf = (feather: number): number => Math.min(Math.max(Math.round(feather), 0), MAX_FEATHER);

/** What a row gives a map: the table byte and the grain gain the bake derives from it (the same two numbers `bakeMasks` uses), so equal signatures bake equal bytes. */
function signatureOf(row: BakeRow, which: MapName): string {
  const gain = row.mix === undefined ? 0 : row.mix[which] * MIX_SENSITIVITY * (row.mix.invert ? -1 : 1);
  return `${toByte(row[which])}:${gain === 0 ? 0 : gain}`;
}

/**
 * Mask-bake-session R4: the maps (and the labels) a bake must recompute, found by comparing the rows and the feather the maps were last baked from with those now asked for.
 * Null means no difference in anything the bake reads, so there is nothing to bake. A feather change, or a different number of rows, changes both maps at every label.
 */
export function findChangedMaps(baked: BakedFrom, wanted: BakedFrom): ChangedBake | null {
  if (radiusOf(baked.feather) !== radiusOf(wanted.feather) || baked.rows.length !== wanted.rows.length) return { maps: ['rough', 'metal'], labels: 'all' };
  const maps = new Set<MapName>();
  const labels = new Set<number>();
  wanted.rows.forEach((row, label) => {
    for (const which of ['rough', 'metal'] as const) {
      if (signatureOf(baked.rows[label]!, which) !== signatureOf(row, which)) {
        maps.add(which);
        labels.add(label);
      }
    }
  });
  if (maps.size === 0) return null;
  return { maps: (['rough', 'metal'] as const).filter((which) => maps.has(which)), labels: labels.size === wanted.rows.length ? 'all' : [...labels].sort((a, b) => a - b) };
}
