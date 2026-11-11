import { describe, expect, it } from 'vitest';
import type { PixelImage } from '@mat/imageops';
import { bakeCurrentRows, hexToRgb, paletteFor, parseBaseMaterials, requantiseModelMasks, setRowValue, makeRow, type MasksRecord } from '@mat/masks';

const table = parseBaseMaterials({ Brick: [0.8, 0, [160, 60, 40]], Steel: [0.3, 1, [200, 200, 205]] });
const palette = paletteFor(2);
const component = (name: string) => ({ name, description: '', location: '' });
const record = (): MasksRecord => ({
  source: 'model',
  palette,
  feather: 0,
  rows: [
    setRowValue(makeRow({ label: 0, component: component('Wall'), match: { material: 'Brick', top3: ['Brick'], kind: 'keyword' }, table }), 'rough', 0.55),
    makeRow({ label: 1, component: component('Plate'), match: { material: 'Steel', top3: ['Steel'], kind: 'embedding' }, table }),
  ],
});
const picture = (side: number, odd = 0): PixelImage => {
  const data = new Uint8Array(side * side * 3);
  for (let y = 0; y < side; y += 1) for (let x = 0; x < side; x += 1) data.set(x < odd ? [128, 128, 128] : hexToRgb(palette[x < (side + odd) / 2 ? 0 : 1]!.hex), (y * side + x) * 3);
  return { width: side, height: side, channels: 3, data };
};

describe('materialgen/masks requantiseModelMasks', () => {
  it('R66 the stored picture is quantised again at S with the record\'s palette; the rows the person changed are kept', () => {
    const before = record();
    const result = requantiseModelMasks({ picture: picture(16), record: before, size: 8 });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect([result.value.labels.width, result.value.labels.channels]).toEqual([8, 1]);
    expect(result.value.record.rows).toEqual(before.rows); // the changed roughness 0.55 stays
    expect(result.value.record.source).toBe('model');
    expect(result.value.record).toEqual(before);
  });

  it('R66 the bake follows the current rows', () => {
    const before = record();
    const result = requantiseModelMasks({ picture: picture(16), record: before, size: 8 });
    if (!result.ok) throw new Error('expected a build');
    expect(result.value.bake).toEqual(bakeCurrentRows(result.value.labels, result.value.record));
    expect(result.value.bake.rough.data[0]).toBe(Math.round(0.55 * 255));
  });

  it('R16 a picture that no longer matches the palette closely is still re-quantised', () => {
    const result = requantiseModelMasks({ picture: picture(16, 12), record: record(), size: 8 });
    expect(result.ok).toBe(true);
  });
});
