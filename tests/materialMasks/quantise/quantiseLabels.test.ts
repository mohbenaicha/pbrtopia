import { describe, expect, it } from 'vitest';
import { quantiseToLabels } from '@shared/materialMasks/quantise/quantiseLabels';
import type { PixelImage } from '@shared/materialMasks';

type Rgb = readonly [number, number, number];
const RED: Rgb = [255, 0, 0];
const BLUE: Rgb = [0, 0, 255];
const GREEN: Rgb = [0, 255, 0];
const YELLOW: Rgb = [255, 255, 0];
const palette = (...hexes: string[]) => hexes.map((hex) => ({ hex }));
const RED_BLUE = palette('#FF0000', '#0000FF');
const PRIMARIES = palette('#FF0000', '#00FF00', '#0000FF', '#FFFF00');
const WITH_GREYS = palette('#FF0000', '#00FF00', '#0000FF', '#FFFF00', '#FF00FF', '#00FFFF', '#000000', '#FFFFFF');

function picture(width: number, height: number, colour: (x: number, y: number) => Rgb): PixelImage {
  const data = new Uint8Array(width * height * 3);
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) data.set(colour(x, y), (y * width + x) * 3);
  }
  return { width, height, channels: 3, data };
}
const flat = (colour: Rgb): PixelImage => picture(8, 8, () => colour);
const label = (labels: PixelImage, x: number, y: number): number => labels.data[y * labels.width + x]!;
/** The label a single flat colour gets (the whole 8 x 8 picture is that colour, so the filter changes nothing). */
const labelOf = (colour: Rgb, colours: ReadonlyArray<{ hex: string }>): number => label(quantiseToLabels(flat(colour), colours, 8).labels, 4, 4);

describe('materialgen/masks quantiseToLabels', () => {
  it('R17 a picture of another size is resampled to S x S, a non-square one stretched to the square', () => {
    const { labels } = quantiseToLabels(picture(2, 1, (x) => (x === 0 ? RED : GREEN)), palette('#FF0000', '#00FF00'), 4);
    expect([labels.width, labels.height, labels.channels]).toEqual([4, 4, 1]);
    expect([0, 1, 2, 3].map((x) => label(labels, x, 2))).toEqual([0, 0, 1, 1]);
  });

  it('R18 each pixel takes the label of the palette entry nearest in hue', () => {
    const { labels } = quantiseToLabels(picture(8, 8, (x) => (x < 4 ? [250, 10, 10] : [10, 10, 245])), RED_BLUE, 8);
    expect([label(labels, 1, 3), label(labels, 6, 3)]).toEqual([0, 1]);
  });

  it('R18 a light green and a mid green still belong to green, not to yellow', () => {
    expect(labelOf([0x6e, 0xf0, 0x09], PRIMARIES)).toBe(1); // hue 100
    expect(labelOf([0x40, 0xc0, 0x40], PRIMARIES)).toBe(1); // hue 120, less bright
  });

  it('R18 a yellow-green nearer to the yellow hue than to green takes yellow', () => {
    expect(labelOf([0x90, 0xe0, 0x10], PRIMARIES)).toBe(3); // hue 76: 16 from yellow, 44 from green
  });

  it('R18 a dark red and a pale blue keep the label of red and blue', () => {
    expect(labelOf([0x8a, 0, 0], PRIMARIES)).toBe(0);
    expect(labelOf([0x50, 0x60, 0xf0], PRIMARIES)).toBe(2);
  });

  it('R18 a hue exactly between two palette hues, at the same value, takes the lower label', () => {
    expect(labelOf(YELLOW, palette('#00FF00', '#FF0000'))).toBe(0);
    expect(labelOf(YELLOW, palette('#FF0000', '#00FF00'))).toBe(0);
  });

  it('R18 a grey pixel takes the grey palette entry nearest in brightness', () => {
    expect(labelOf([204, 204, 204], WITH_GREYS)).toBe(7); // white
    expect(labelOf([26, 26, 26], WITH_GREYS)).toBe(6); // black
  });

  it('R18 a very dark chromatic pixel goes to black when the palette has black', () => {
    expect(labelOf([0x2a, 0, 0], WITH_GREYS)).toBe(6);
  });

  it('R18 without a grey entry a very dark red still takes red, and no pixel is left without a label', () => {
    expect(labelOf([0x2a, 0, 0], PRIMARIES)).toBe(0);
    const { labels } = quantiseToLabels(flat([128, 128, 128]), PRIMARIES, 8);
    expect(Array.from(labels.data).every((value) => value < PRIMARIES.length)).toBe(true);
  });

  it('R18 R19 R21 a patch far from every palette colour still gets a label and the result holds no coverage figure', () => {
    const image = picture(64, 64, (x, y) => (x >= 20 && x < 36 && y >= 20 && y < 36 ? GREEN : RED));
    const quantised = quantiseToLabels(image, RED_BLUE, 64);
    expect(Object.keys(quantised)).toEqual(['labels']);
    expect(Array.from(quantised.labels.data).every((value) => value === 0 || value === 1)).toBe(true);
    expect(label(quantised.labels, 28, 28)).toBe(0); // red and blue are equally far from green: the lower label
  });

  it('R20 the 3 x 3 majority window wraps, so a left-edge pixel counts the right-edge pixels', () => {
    const blueAt = new Set(['0,2', '0,4', '7,2', '7,3', '7,4']);
    const image = picture(8, 8, (x, y) => (blueAt.has(`${x},${y}`) ? BLUE : RED));
    expect(label(quantiseToLabels(image, RED_BLUE, 8).labels, 0, 3)).toBe(1);
  });

  it('R20 an isolated pixel of another colour is outvoted by its window', () => {
    const image = picture(8, 8, (x, y) => (x === 4 && y === 4 ? BLUE : RED));
    expect(label(quantiseToLabels(image, RED_BLUE, 8).labels, 4, 4)).toBe(0);
  });

  it('R23 palette colours with noise of up to 12 per channel keep their labels', () => {
    let seed = 7;
    const noise = (): number => {
      seed = (seed * 1103515245 + 12345) & 0x7fffffff;
      return (seed % 25) - 12;
    };
    const clamp = (value: number): number => Math.max(0, Math.min(255, value));
    const quadrant: Rgb[] = [RED, GREEN, BLUE, YELLOW];
    const image = picture(32, 32, (x, y) => {
      const [r, g, b] = quadrant[(y < 16 ? 0 : 2) + (x < 16 ? 0 : 1)]!;
      return [clamp(r + noise()), clamp(g + noise()), clamp(b + noise())];
    });
    const { labels } = quantiseToLabels(image, PRIMARIES, 32);
    for (let y = 0; y < 32; y += 1) {
      for (let x = 0; x < 32; x += 1) expect(label(labels, x, y)).toBe((y < 16 ? 0 : 2) + (x < 16 ? 0 : 1));
    }
  });

  it('R23 the same input always gives the same labels', () => {
    const image = picture(32, 32, (x, y) => [(x * 8) % 256, (y * 8) % 256, (x * y) % 256]);
    const colours = palette('#FF0000', '#00FF00', '#0000FF', '#FFFF00', '#000000');
    const first = quantiseToLabels(image, colours, 32);
    const second = quantiseToLabels(image, colours, 32);
    expect(Array.from(first.labels.data)).toEqual(Array.from(second.labels.data));
  });

  it('R17 a picture with an alpha channel is read by its colour', () => {
    const data = new Uint8Array(4 * 4 * 4);
    for (let i = 0; i < 16; i += 1) data.set([255, 0, 0, 7], i * 4);
    const { labels } = quantiseToLabels({ width: 4, height: 4, channels: 4, data }, RED_BLUE, 4);
    expect(Array.from(labels.data).every((value) => value === 0)).toBe(true);
  });
});

describe('material-masks-core quantiseToLabels edges', () => {
  // Red at the four top-left cells, blue on the last row and column: only the wrap decides the corner's majority.
  const corner = picture(3, 3, (x, y) => (x < 2 && y < 2 ? RED : BLUE));

  it('material-masks-core R5 the cleanup wraps by default and clamps when asked', () => {
    expect(label(quantiseToLabels(corner, RED_BLUE, 3).labels, 0, 0)).toBe(1);
    expect(label(quantiseToLabels(corner, RED_BLUE, 3, 'wrap').labels, 0, 0)).toBe(1);
    expect(label(quantiseToLabels(corner, RED_BLUE, 3, 'clamp').labels, 0, 0)).toBe(0);
  });
});
