import { describe, expect, it } from 'vitest';
import type { PixelImage } from '@shared/materialMasks';
import { bakeCurrentRows, type MasksRecord } from '@shared/materialMasks';

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
    { label: 0, name: 'Wall', description: '', location: '', defaultMaterial: 'Brick', top3: ['Brick'], matchKind: 'keyword', material: 'Brick', rough: 0.8, metal: 0, height: 0 },
    { label: 1, name: 'Plate', description: '', location: '', defaultMaterial: 'Steel', top3: ['Steel'], matchKind: 'keyword', material: 'Steel', rough: 0.3, metal: 1, height: 0 },
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

  it('mask-mode R28 with an island coverage the gutter beside the island takes the island\'s values, within reach only; without one the bake is as before', () => {
    const coverage = new Uint8Array(64);
    for (let row = 0; row < 8; row += 1) coverage.fill(1, row * 8, row * 8 + 4); // the left half is island
    const dilated = bakeCurrentRows(halves(), record(0), undefined, undefined, undefined, undefined, coverage); // reach at S = 8 is 1 texel
    expect([dilated.rough.data[4], dilated.metal.data[4]]).toEqual([Math.round(0.8 * 255), 0]); // column 4 was the plate, now the wall's
    expect(dilated.rough.data[5]).toBe(Math.round(0.3 * 255)); // beyond reach
    expect(bakeCurrentRows(halves(), record(0)).rough.data[4]).toBe(Math.round(0.3 * 255));
  });

  it('R91 a row with the colour mixin on takes the albedo grey it is given into its roughness; without the grey the rows bake as before', () => {
    const grey: PixelImage = { width: 8, height: 8, channels: 1, data: Uint8Array.from({ length: 64 }, (_, index) => (index % 2 === 0 ? 100 : 200)) };
    const mixed: MasksRecord = { ...record(0), rows: record(0).rows.map((row) => ({ ...row, rough: 0.5, mix: { on: true, invert: false, rough: 1, metal: 0 } })) };
    const withGrey = bakeCurrentRows(halves(), mixed, grey);
    expect(new Set(withGrey.rough.data)).toEqual(new Set([103, 153]));
    expect(new Set(bakeCurrentRows(halves(), mixed).rough.data)).toEqual(new Set([128]));
  });
});
