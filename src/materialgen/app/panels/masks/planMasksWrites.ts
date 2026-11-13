import { hasHeightOffset, type MasksRecord } from '@mat/masks';

/** Which of the baked maps one masks commit has to write. */
export interface MasksWrites {
  roughMetal: boolean;
  height: boolean;
}

const heightsOf = (record: MasksRecord): string => record.rows.map((row) => `${row.label}:${row.height}`).join(',');

/**
 * Masks R85, R87: a change of height offsets alone writes Height alone, and a change of anything else writes rough and metal and never Height; a feather
 * change or rebuilt labels also write Height while an offset is set (its edges follow the labels and the feather). A change that alters nothing still bakes
 * rough and metal, as it always did.
 */
export function planMasksWrites(previous: MasksRecord | null, next: MasksRecord, relabelled: boolean): MasksWrites {
  const heightsChanged = previous === null ? hasHeightOffset(next.rows) : heightsOf(previous) !== heightsOf(next);
  const shapeChanged = relabelled || (previous !== null && previous.feather !== next.feather);
  const otherChanged = shapeChanged || previous === null || previous.rows.some((row, index) => row.rough !== next.rows[index]?.rough || row.metal !== next.rows[index]?.metal || row.material !== next.rows[index]?.material || JSON.stringify(row.mix) !== JSON.stringify(next.rows[index]?.mix)); // R92: the Colour mixin shapes rough and metal only
  return { roughMetal: otherChanged || !heightsChanged, height: heightsChanged || (shapeChanged && hasHeightOffset(next.rows)) };
}
