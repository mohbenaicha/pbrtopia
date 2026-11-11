import { describe, expect, it } from 'vitest';
import type { PixelImage } from '@mat/imageops';
import { DEFAULT_FEATHER, buildModelMasks, hexToRgb, paletteFor, parseBaseMaterials, type MaterialMatch } from '@mat/masks';

const table = parseBaseMaterials({ Brick: [0.8, 0, [160, 60, 40]], Steel: [0.3, 1, [200, 200, 205]], Moss: [0.9, 0, [60, 120, 40]] });
const components = [
  { name: 'Brick', description: 'red', location: 'left' },
  { name: 'Steel', description: 'grey', location: 'right' },
];
const matches: MaterialMatch[] = [
  { material: 'Brick', top3: ['Brick'], kind: 'keyword' },
  { material: 'Steel', top3: ['Steel', 'Moss'], kind: 'embedding' },
];
const [first, second] = paletteFor(2);

/** The left `share` of the picture is palette colour 0, the rest palette colour 1, except `noise` columns filled with a colour near neither. */
function picture(side: number, noiseColumns = 0): PixelImage {
  const data = new Uint8Array(side * side * 3);
  for (let y = 0; y < side; y += 1) {
    for (let x = 0; x < side; x += 1) {
      const rgb = x < noiseColumns ? [128, 128, 128] : hexToRgb((x < (side + noiseColumns) / 2 ? first : second)!.hex);
      data.set(rgb, (y * side + x) * 3);
    }
  }
  return { width: side, height: side, channels: 3, data };
}

describe('materialgen/masks buildModelMasks', () => {
  it('R17 R30 R10 the labels are at S and follow the palette colours of the decomposition picture', () => {
    const result = buildModelMasks({ decomposition: picture(16), components, matches, table, size: 8, feather: DEFAULT_FEATHER });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const { labels, record } = result.value;
    expect([labels.width, labels.height, labels.channels]).toEqual([8, 8, 1]);
    expect(labels.data[0]).toBe(0);
    expect(labels.data[7]).toBe(1);
    expect(record.source).toBe('model');
    expect(record.palette.map((entry) => entry.label)).toEqual([0, 1]);
  });

  it('R41 R74 each row keeps the matched base material, its top 3 and its values; the match kind is kept', () => {
    const result = buildModelMasks({ decomposition: picture(16), components, matches, table, size: 8, feather: 0 });
    if (!result.ok) throw new Error('expected a build');
    const [brick, steel] = result.value.record.rows;
    expect([brick!.material, brick!.rough, brick!.metal, brick!.matchKind]).toEqual(['Brick', 0.8, 0, 'keyword']);
    expect([steel!.material, steel!.top3, steel!.rough, steel!.metal, steel!.matchKind]).toEqual(['Steel', ['Steel', 'Moss'], 0.3, 1, 'embedding']);
  });

  it('R42 R43 the first bake follows the rows', () => {
    const result = buildModelMasks({ decomposition: picture(16), components, matches, table, size: 8, feather: 0 });
    if (!result.ok) throw new Error('expected a build');
    expect(result.value.bake.rough.data[0]).toBe(Math.round(0.8 * 255));
    expect(result.value.bake.metal.data[7]).toBe(255);
  });

  it('R16 a picture whose colours drifted far from the palette is built, not failed, and no coverage is recorded', () => {
    const result = buildModelMasks({ decomposition: picture(16, 10), components, matches, table, size: 8, feather: 0 });
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.value.record).not.toHaveProperty('coverage');
  });

  it('R16 a plain grey picture is still built', () => {
    const grey: PixelImage = { width: 4, height: 4, channels: 3, data: new Uint8Array(4 * 4 * 3).fill(128) };
    const result = buildModelMasks({ decomposition: grey, components, matches, table, size: 8, feather: 0 });
    expect(result.ok).toBe(true);
  });

  it('R18 colours that drifted from the palette keep the label of their hue', () => {
    const drifted: PixelImage = { width: 2, height: 1, channels: 3, data: Uint8Array.from([0xd0, 0x30, 0x20, 0x20, 0x40, 0xe0]) };
    const result = buildModelMasks({ decomposition: drifted, components, matches, table, size: 8, feather: 0 });
    if (!result.ok) throw new Error('expected a build');
    expect([result.value.labels.data[0], result.value.labels.data[7]]).toEqual([0, 1]);
  });
});
