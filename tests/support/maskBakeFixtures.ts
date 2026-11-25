import { paletteFor, type BakedMaps, type MaskRow, type MasksRecord, type PixelImage } from '../../src/materialMasks';
import type { UvMesh } from '../../src/generation/normal/uprightTypes';

/** A small deterministic random source (mulberry32), so a failing random test can be replayed from its seed. */
export function seededRandom(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let mixed = Math.imul(state ^ (state >>> 15), state | 1);
    mixed ^= mixed + Math.imul(mixed ^ (mixed >>> 7), mixed | 61);
    return ((mixed ^ (mixed >>> 14)) >>> 0) / 4294967296;
  };
}

/** `columns` x `columns` square islands (two triangles each) in the UV square; an island fills `1 - 2 * margin` of its cell, the rest is gutter. */
export function makeIslandMesh(columns: number, margin = 0.1): UvMesh {
  const uvs: number[] = [];
  const indices: number[] = [];
  const cell = 1 / columns;
  for (let row = 0; row < columns; row += 1) {
    for (let column = 0; column < columns; column += 1) {
      const x0 = column * cell + margin * cell;
      const x1 = (column + 1) * cell - margin * cell;
      const y0 = row * cell + margin * cell;
      const y1 = (row + 1) * cell - margin * cell;
      const first = uvs.length / 2;
      uvs.push(x0, y0, x1, y0, x1, y1, x0, y1);
      indices.push(first, first + 1, first + 2, first, first + 2, first + 3);
    }
  }
  return { positions: new Float32Array((uvs.length / 2) * 3), uvs: Float32Array.from(uvs), indices: Uint32Array.from(indices) };
}

/** Labels for the island grid of `makeIslandMesh(columns, margin)`: the island of cell k carries `labelOfCell(k)` (255 = no mask); the gutter is 255. */
export function labelIslandGrid(side: number, columns: number, margin: number, labelOfCell: (cell: number) => number): Uint8Array {
  const labels = new Uint8Array(side * side).fill(255);
  const cell = side / columns;
  for (let row = 0; row < side; row += 1) {
    for (let column = 0; column < side; column += 1) {
      const cellRow = Math.floor(row / cell);
      const cellColumn = Math.floor(column / cell);
      const x = column / cell - cellColumn;
      const y = row / cell - cellRow;
      if (x < margin || x > 1 - margin || y < margin || y > 1 - margin) continue;
      labels[row * side + column] = labelOfCell(cellRow * columns + cellColumn);
    }
  }
  return labels;
}

export const greyPlane = (side: number, fill: (index: number) => number): PixelImage => {
  const data = new Uint8Array(side * side);
  for (let index = 0; index < data.length; index += 1) data[index] = fill(index);
  return { width: side, height: side, channels: 1, data };
};

export const flatMaps = (side: number, rough: number, metal: number): BakedMaps => ({ rough: greyPlane(side, () => rough), metal: greyPlane(side, () => metal) });

export function makeRow(label: number, random: () => number, withMix = false): MaskRow {
  return {
    label, name: `part ${label}`, description: 'd', location: 'l', defaultMaterial: 'Steel', top3: [], matchKind: 'generic', material: 'Steel',
    rough: Math.round(random() * 100) / 100, metal: Math.round(random() * 100) / 100, height: 0,
    ...(withMix ? { mix: { on: true, invert: random() < 0.5, rough: Math.round(random() * 100) / 100, metal: Math.round(random() * 100) / 100 } } : {}),
  };
}

export function makeRecord(rowCount: number, random: () => number, feather: number, mixRows: readonly number[] = []): MasksRecord {
  return { source: 'model', palette: paletteFor(Math.max(rowCount, 1)), feather, rows: Array.from({ length: rowCount }, (_, label) => makeRow(label, random, mixRows.includes(label))) };
}
