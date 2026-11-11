import { describe, expect, it } from 'vitest';
import type { CanvasRule } from '@shared/generation/catalog/canvasRules';
import type { PixelImage } from '@mat/maps';
import { chooseLayout, type PackedLayout } from '@mat/generation/layout/chooseLayout';
import { checkReturnedSize, computeTileCrop, describeAspect, labelImage, splitReturnedImage, type CropRect } from '@mat/generation/split/splitReturnedImage';

const listRule = (canvases: Array<[number, number]>): CanvasRule => ({ kind: 'list', byResolution: { '1K': canvases.map(([width, height]) => ({ width, height })) } });
const layoutOf = (count: number, canvas: [number, number]): PackedLayout => {
  const choice = chooseLayout(listRule([canvas]), '1K', count);
  if (!choice.ok) throw new Error(choice.reason);
  return choice.layout;
};
/** RGB pixels whose red channel is x mod 256 and green is y mod 256, so a crop shows where it came from. */
const coordinates = (width: number, height: number): PixelImage => {
  const data = new Uint8Array(width * height * 3);
  for (let y = 0; y < height; y += 1) for (let x = 0; x < width; x += 1) data.set([x % 256, y % 256, 7], (y * width + x) * 3);
  return { width, height, channels: 3, data };
};

describe('materialgen/generation R47 validating a returned image', () => {
  it('R47 an aspect off by more than 1% fails, naming the image and the canvas aspect', () => {
    const layout = layoutOf(2, [1024, 512]);
    expect(checkReturnedSize('Image 2 (Normal)', layout, 1024, 1024)).toBe('Image 2 (Normal): the returned image is not 2:1.');
    expect(checkReturnedSize('Image 2 (Normal)', layout, 1024, 512)).toBeNull();
    expect(checkReturnedSize('Image 2 (Normal)', layout, 1024, 516)).toBeNull(); // 0.8% off
    expect(checkReturnedSize('Image 2 (Normal)', layout, 1024, 524)).not.toBeNull(); // 2.3% off
  });

  it('R47 R52 a Gemini image 1376x768 for a 16:9 canvas of 1024x576 passes', () => {
    const layout = layoutOf(1, [1024, 576]);
    expect(checkReturnedSize('Image 1 (Albedo)', layout, 1376, 768)).toBeNull();
  });

  it('R47 a tile under 64 returned pixels fails', () => {
    const layout = layoutOf(3, [932, 300]);
    const problem = checkReturnedSize('Image 1 (Albedo, Normal, Height)', layout, 186, 60);
    expect(problem).toContain('too small');
  });

  it('R47 an image is named by position and maps', () => {
    expect(labelImage(2, ['Normal'])).toBe('Image 2 (Normal)');
    expect(labelImage(1, ['Albedo', 'Normal'])).toBe('Image 1 (Albedo, Normal)');
    expect(describeAspect(1024, 576)).toBe('16:9');
    expect(describeAspect(932, 300)).toBe('3.11:1');
  });
});

describe('materialgen/generation R48 R49 R53 splitting', () => {
  it('R48 a lone map is the whole image, with no inset', () => {
    const layout = layoutOf(1, [512, 512]);
    const outcome = splitReturnedImage('Image 1 (Albedo)', layout, coordinates(512, 512));
    expect(outcome.ok).toBe(true);
    if (outcome.ok) {
      expect([outcome.tiles[0]!.width, outcome.tiles[0]!.height]).toEqual([512, 512]);
      expect(outcome.tiles[0]!.data[0]).toBe(0);
    }
  });

  it('R48 each tile is cut exactly to its cell, with no inset', () => {
    const layout = layoutOf(3, [900, 300]);
    expect(computeTileCrop(layout.tiles[0]!, layout, 900, 300)).toEqual({ x: 0, y: 0, width: 300, height: 300 });
    expect(computeTileCrop(layout.tiles[1]!, layout, 900, 300)).toEqual({ x: 300, y: 0, width: 300, height: 300 });
    const stack = layoutOf(2, [256, 512]); // 1x2: cells of 256 x 256
    expect(computeTileCrop(stack.tiles[1]!, stack, 256, 512)).toEqual({ x: 0, y: 256, width: 256, height: 256 });
  });

  it('R48 neighbouring crops touch: no pixel is lost between them', () => {
    const layout = layoutOf(3, [900, 300]);
    const [a, b, c] = layout.tiles.map((tile) => computeTileCrop(tile, layout, 900, 300)) as [CropRect, CropRect, CropRect];
    expect(b.x).toBe(a.x + a.width);
    expect(c.x).toBe(b.x + b.width);
  });

  it('R48 the cut pixels come from the tile, not from the next one', () => {
    const layout = layoutOf(3, [900, 300]);
    const outcome = splitReturnedImage('Image 1', layout, coordinates(900, 300));
    expect(outcome.ok).toBe(true);
    if (!outcome.ok) return;
    expect(outcome.tiles).toHaveLength(3);
    expect(outcome.tiles[1]!.data[0]).toBe(300 % 256); // red of the first pixel of the second tile: x = 300
    expect(outcome.tiles[1]!.data[1]).toBe(0); // green: y = 0
  });

  it('R49 a returned size one pixel short of the canvas still splits by fractions and reads nothing beyond the image', () => {
    const layout = layoutOf(3, [3000, 1000]);
    const outcome = splitReturnedImage('Image 1', layout, coordinates(2999, 1000));
    expect(outcome.ok).toBe(true);
    if (!outcome.ok) return;
    expect(outcome.tiles).toHaveLength(3);
    for (let index = 0; index < 3; index += 1) {
      const rect = computeTileCrop(layout.tiles[index]!, layout, 2999, 1000);
      expect(rect.x).toBeGreaterThanOrEqual(0);
      expect(rect.x + rect.width).toBeLessThanOrEqual(2999);
      expect(rect.y + rect.height).toBeLessThanOrEqual(1000);
    }
  });

  it('R47 R53 an image that fails validation gives no tile at all', () => {
    const layout = layoutOf(2, [1024, 512]);
    const outcome = splitReturnedImage('Image 1 (Albedo, Normal)', layout, coordinates(512, 512));
    expect(outcome).toEqual({ ok: false, message: 'Image 1 (Albedo, Normal): the returned image is not 2:1.' });
  });

  it('R53 a tile that cannot be cut fails the whole image', () => {
    const layout = layoutOf(2, [1024, 512]);
    const crowded: PackedLayout = { ...layout, tiles: [layout.tiles[0]!, { x: 5000, y: 0, width: 100, height: 100 }] };
    const outcome = splitReturnedImage('Image 1', crowded, coordinates(1024, 512));
    expect(outcome.ok).toBe(false);
  });
});
