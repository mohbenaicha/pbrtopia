import { describe, expect, it } from 'vitest';
import type { PixelImage } from '@shared/materialMasks';
import { bakeCurrentRows, buildModelMasks, makeRow, paletteFor, parseBaseMaterials, requantiseModelMasks, hexToRgb, type MasksRecord } from '@shared/materialMasks';
import { runMaskJob } from '@shared/materialMasks/worker/maskJobs';

const table = parseBaseMaterials({ Brick: [0.8, 0, [160, 60, 40]], Steel: [0.3, 1, [200, 200, 205]] });
const palette = paletteFor(2);
const component = (name: string) => ({ name, description: '', location: '' });
const modelInput = () => ({
  decomposition: picture(8), components: [component('Wall'), component('Plate')], table, size: 8, feather: 1,
  matches: [{ material: 'Brick', top3: ['Brick'], kind: 'keyword' as const }, { material: 'Steel', top3: ['Steel'], kind: 'keyword' as const }],
});
const modelRecord = (): MasksRecord => ({
  source: 'model', palette, feather: 0,
  rows: [makeRow({ label: 0, component: component('Wall'), match: { material: 'Brick', top3: ['Brick'], kind: 'keyword' }, table }), makeRow({ label: 1, component: component('Plate'), match: { material: 'Steel', top3: ['Steel'], kind: 'keyword' }, table })],
});
const picture = (side: number): PixelImage => {
  const data = new Uint8Array(side * side * 3);
  for (let y = 0; y < side; y += 1) for (let x = 0; x < side; x += 1) data.set(hexToRgb(palette[x < side / 2 ? 0 : 1]!.hex), (y * side + x) * 3);
  return { width: side, height: side, channels: 3, data };
};

describe('materialgen/masks R24 R45 runMaskJob', () => {
  it('R45 a bake job gives the maps bakeCurrentRows gives', () => {
    const built = buildModelMasks(modelInput());
    if (!built.ok) throw new Error(built.message);
    const { labels, record } = built.value;
    expect(runMaskJob('bake', { labels, record })).toEqual(bakeCurrentRows(labels, record));
  });

  it('R24 a model job gives what buildModelMasks gives', () => {
    const input = modelInput();
    expect(runMaskJob('model', input)).toEqual(buildModelMasks(input));
  });

  it('R24 a requantise job gives what requantiseModelMasks gives', () => {
    const input = { picture: picture(8), record: modelRecord(), size: 8 };
    expect(runMaskJob('requantise', input)).toEqual(requantiseModelMasks(input));
    const grey: PixelImage = { width: 8, height: 8, channels: 3, data: new Uint8Array(8 * 8 * 3).fill(128) };
    expect(runMaskJob('requantise', { ...input, picture: grey })).toEqual(requantiseModelMasks({ ...input, picture: grey }));
  });
});
