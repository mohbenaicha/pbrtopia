import { describe, expect, it } from 'vitest';
import type { PixelImage } from '@mat/imageops';
import { bakeCurrentRows, type MasksRecord } from '@mat/masks';

/** Labels whose left half is label 0 and right half label 1. */
const halves = (side = 8): PixelImage => {
  const data = new Uint8Array(side * side);
  for (let y = 0; y < side; y += 1) for (let x = 0; x < side; x += 1) data[y * side + x] = x < side / 2 ? 0 : 1;
  return { width: side, height: side, channels: 1, data };
};
const record = (feather: number): MasksRecord => ({
  source: 'model',
  palette: [{ label: 0, hex: '#FF0000', name: 'red' }, { label: 1, hex: '#00FF00', name: 'green' }],
  feather,
  rows: [
    { label: 0, name: 'Wall', description: '', location: '', defaultMaterial: 'Brick', top3: ['Brick'], matchKind: 'keyword', material: 'Brick', rough: 0.8, metal: 0 },
    { label: 1, name: 'Plate', description: '', location: '', defaultMaterial: 'Steel', top3: ['Steel'], matchKind: 'keyword', material: 'Steel', rough: 0.3, metal: 1 },
  ],
});

describe('materialgen/masks bakeCurrentRows', () => {
  it('R42 R43 with no feather each region holds its own row value', () => {
    const bake = bakeCurrentRows(halves(), record(0));
    expect(bake.rough.data[0]).toBe(Math.round(0.8 * 255));
    expect(bake.rough.data[7]).toBe(Math.round(0.3 * 255));
    expect(bake.metal.data[0]).toBe(0);
    expect(bake.metal.data[7]).toBe(255);
  });

  it('R50 R54 rebaking uses the rows and the feather as the record has them now', () => {
    const edited: MasksRecord = { ...record(0), rows: record(0).rows.map((row) => ({ ...row, rough: 0.25 })) };
    expect(new Set(bakeCurrentRows(halves(), edited).rough.data)).toEqual(new Set([Math.round(0.25 * 255)]));
  });
});
