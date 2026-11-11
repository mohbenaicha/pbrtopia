import type { MasksRecord } from '@mat/workerapi';

export interface MasksJson {
  labels: Array<{ index: number; hex: string; name: string; baseMaterial: string; roughness: number; metal: number }>;
}

/** Export R23: each label with its index, palette colour, name, base material and the roughness and metal values as stored. */
export function buildMasksJson(record: MasksRecord): MasksJson {
  return {
    labels: record.rows.map((row) => ({
      index: row.label,
      hex: record.palette.find((entry) => entry.label === row.label)?.hex ?? '#000000',
      name: row.name,
      baseMaterial: row.material,
      roughness: row.rough,
      metal: row.metal,
    })),
  };
}
