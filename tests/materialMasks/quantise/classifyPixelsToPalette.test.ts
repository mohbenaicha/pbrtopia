import { describe, expect, it } from 'vitest';
import type { PixelImage } from '@shared/materialMasks';
import { paletteFor } from '@shared/materialMasks/palette/palette';
import { classifyPixelsToPalette, NONE_LABEL } from '@shared/materialMasks/quantise/classifyPixelsToPalette';
import { majorityFilter } from '@shared/materialMasks/quantise/labelCleanup';
import { toHueEntries } from '@shared/materialMasks/quantise/hueRange';
import { quantiseToLabels } from '@shared/materialMasks/quantise/quantiseLabels';

type Rgb = readonly [number, number, number];
const palette = (...hexes: string[]) => hexes.map((hex) => ({ hex }));
const PRIMARIES = palette('#FF0000', '#00FF00', '#0000FF', '#FFFF00');
const RED: Rgb = [255, 0, 0];
const BLUE: Rgb = [0, 0, 255];
const strip = (colours: readonly Rgb[]): PixelImage => {
  const data = new Uint8Array(colours.length * 3);
  colours.forEach((colour, index) => data.set(colour, index * 3));
  return { width: colours.length, height: 1, channels: 3, data };
};
/** A seeded noise picture; the goldens below were recorded from the quantiser before it was rebuilt on classifyPixelsToPalette. */
const noise = (width: number, height: number, channels: 1 | 3 | 4): PixelImage => {
  let seed = 12345;
  const next = (): number => {
    seed = (seed * 1103515245 + 12345) & 0x7fffffff;
    return (seed >> 8) & 255;
  };
  const data = new Uint8Array(width * height * channels);
  for (let index = 0; index < data.length; index += 1) data[index] = next();
  return { width, height, channels, data };
};
const FIVE = paletteFor(5);

describe('material-masks-core classifyPixelsToPalette', () => {
  it('material-masks-core R12 exact palette colours map to their own labels', () => {
    const image = strip([[255, 0, 0], [0, 255, 0], [0, 0, 255], [255, 255, 0]]);
    expect(Array.from(classifyPixelsToPalette(image, PRIMARIES))).toEqual([0, 1, 2, 3]);
  });

  it('material-masks-core R12 drifted colours (lime, dark red) go to the nearest used entry', () => {
    expect(Array.from(classifyPixelsToPalette(strip([[0x6e, 0xf0, 0x09], [0x8b, 0x10, 0x10]]), PRIMARIES))).toEqual([1, 0]);
  });

  it('material-masks-core R12 a pixel within the background tolerance gives 255 and one outside it does not', () => {
    const image = strip([[10, 20, 30], [14, 24, 34], [16, 26, 36], RED]);
    const labels = classifyPixelsToPalette(image, PRIMARIES, { rgb: [10, 20, 30], tolerance: 5 });
    expect(NONE_LABEL).toBe(255);
    expect(Array.from(labels).slice(0, 2)).toEqual([255, 255]);
    expect(labels[2]).not.toBe(255);
    expect(labels[3]).toBe(0);
  });

  it('material-masks-core R12 the output has one label per pixel at the input size, with no resampling', () => {
    expect(classifyPixelsToPalette(noise(5, 3, 3), FIVE).length).toBe(15);
    expect(classifyPixelsToPalette(noise(300, 2, 4), FIVE).length).toBe(600);
  });

  it('material-masks-core R12 a pixel label does not depend on its neighbours: no blur, no cleanup', () => {
    const colours: Rgb[] = Array.from({ length: 9 }, (_, index) => (index === 4 ? RED : BLUE));
    const image: PixelImage = { width: 3, height: 3, channels: 3, data: Uint8Array.from(colours.flat()) };
    expect(Array.from(classifyPixelsToPalette(image, PRIMARIES))).toEqual([2, 2, 2, 2, 0, 2, 2, 2, 2]); // a majority filter would erase the red pixel
  });

  it('material-masks-core R12 RGBA pictures ignore alpha and grey pictures read as grey colour', () => {
    expect(Array.from(classifyPixelsToPalette({ width: 2, height: 1, channels: 4, data: Uint8Array.from([255, 0, 0, 7, 0, 0, 255, 255]) }, PRIMARIES))).toEqual([0, 2]);
    expect(Array.from(classifyPixelsToPalette({ width: 2, height: 1, channels: 1, data: Uint8Array.from([0, 255]) }, palette('#000000', '#FFFFFF')))).toEqual([0, 1]);
  });
});

describe('material-masks-core quantiseToLabels rebuilt on classifyPixelsToPalette', () => {
  it('material-masks-core R12 the output equals the stored goldens (matching size, other size, RGBA)', () => {
    const golden8 = [2,1,4,4,3,3,3,2,2,1,1,1,2,2,2,2,1,1,1,1,1,2,2,2,2,2,4,1,2,1,2,2,4,4,4,1,1,1,1,1,4,4,4,2,2,1,1,4,4,4,4,4,1,4,1,4,2,2,2,4,4,3,2,2];
    const golden13x9 = [2,2,1,1,1,2,2,4,0,0,1,1,2,2,2,2,0,2,1,1,2,2,2,2,2,2,2,1,4,4,2,2,2,2,2,1,1,4,3,3,1,1,1,3,1,3,3,3,1,1,3,3,1,3,3,3,4,2,3,3,1,1,4,4];
    const goldenRgba = [2,2,2,2,1,1,1,1,1,2,2,2,1,1,1,1,1,2,2,2,1,1,1,1,2,0,2,2,1,1,2,2,4,4,4,4,4,1,2,2,4,4,4,4,2,3,2,4,0,4,4,4,2,3,3,3,0,2,2,4,2,1,2,0];
    expect(Array.from(quantiseToLabels(noise(8, 8, 3), FIVE, 8).labels.data)).toEqual(golden8);
    expect(Array.from(quantiseToLabels(noise(13, 9, 3), FIVE, 8).labels.data)).toEqual(golden13x9);
    expect(Array.from(quantiseToLabels(noise(8, 8, 4), FIVE, 8).labels.data)).toEqual(goldenRgba);
  });

  it('material-masks-core R12 with the picture already at the target size the result is the classification followed by the cleanup', () => {
    const image = noise(8, 8, 3);
    const direct = majorityFilter(classifyPixelsToPalette(image, FIVE), 8, toHueEntries(FIVE).length);
    expect(Array.from(quantiseToLabels(image, FIVE, 8).labels.data)).toEqual(Array.from(direct));
  });
});
