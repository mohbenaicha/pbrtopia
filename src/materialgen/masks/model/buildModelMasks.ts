import type { PixelImage } from '@mat/workerapi';
import type { Component } from '../describe/parseComponents';
import { paletteFor } from '../palette/palette';
import { bakeCurrentRows, type MasksBuild } from '../pipeline/bakeCurrentRows';
import { quantiseToLabels } from '../quantise/quantiseLabels';
import { makeRow } from '../record/maskRows';
import type { MasksRecord } from '../record/masksRecord';
import type { BaseMaterialTable } from '../table/baseMaterials';
import type { MaterialMatch } from '../table/matchMaterials';
import type { StepOutcome } from './stepOutcome';

export interface ModelMasksInput {
  decomposition: PixelImage; // the picture the image model returned, at its own size
  components: ReadonlyArray<Component>;
  matches: ReadonlyArray<MaterialMatch>; // one per component, in the same order
  table: BaseMaterialTable;
  size: number; // S
  feather: number;
}

/**
 * Masks R10, R15-R18, R30, R41, R42: the labels of a decomposition picture at S (palette entry k is component k, matched by hue range), the
 * record of source "model" with one row per component, and the first bake. A picture whose colours drifted is built all the same (R16).
 */
export function buildModelMasks({ decomposition, components, matches, table, size, feather }: ModelMasksInput): StepOutcome<MasksBuild> {
  const palette = paletteFor(components.length);
  const quantised = quantiseToLabels(decomposition, palette, size);
  const rows = components.map((component, label) => makeRow({ label, component, match: matches[label] ?? { material: '', top3: [], kind: 'keyword' }, table }));
  const record: MasksRecord = { source: 'model', palette, feather, rows };
  return { ok: true, value: { labels: quantised.labels, record, bake: bakeCurrentRows(quantised.labels, record) } };
}
