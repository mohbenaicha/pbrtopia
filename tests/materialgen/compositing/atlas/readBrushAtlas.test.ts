import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { BRUSH_ATLAS_ERROR, BRUSH_GRID, readBrushAtlas } from '../../../../src/materialgen/compositing/atlas/readBrushAtlas';
import { tileRect } from '../../../../src/materialgen/compositing/gpu/stampGeometry';
import { encodePng } from '../../../../src/materialgen/maps/png/pngCodec';

const shipped = (): Uint8Array => new Uint8Array(readFileSync('src/materialgen/compositing/atlas/brush_atlas.png'));

describe('materialgen/compositing brush atlas (R6 R36)', () => {
  it('R6 the shipped atlas holds 200 shapes in a 10 x 20 grid of one-byte pixels', () => {
    const atlas = readBrushAtlas(shipped());
    expect(atlas.count).toBe(200);
    expect(atlas.grid).toEqual({ columns: 10, rows: 20, inset: BRUSH_GRID.inset });
    expect(atlas.data.length).toBe(atlas.width * atlas.height);
    expect(atlas.width).toBe(2080);
    expect(atlas.height).toBe(4160);
  });

  it('R6 the tile rectangle of a shape sits inside its cell and repeats its edge in the gutter around it', () => {
    const atlas = readBrushAtlas(shipped());
    for (const index of [0, 37, 199]) {
      const rect = tileRect(atlas.grid, index);
      const left = Math.round(rect.u0 * atlas.width);
      const top = Math.round((1 - (rect.v0 + rect.dv)) * atlas.height); // rows run top to bottom
      const row = top + 50;
      expect(atlas.data[row * atlas.width + left - 1]).toBe(atlas.data[row * atlas.width + left]);
      expect(atlas.data[row * atlas.width + left - 6]).toBe(atlas.data[row * atlas.width + left]);
    }
  });

  it('R36 an image that is not the atlas, or bytes that are not a PNG, are the one load error', () => {
    const wrongSize = encodePng({ width: 4, height: 4, channels: 1, data: new Uint8Array(16) });
    expect(() => readBrushAtlas(wrongSize)).toThrow(BRUSH_ATLAS_ERROR);
    expect(() => readBrushAtlas(new Uint8Array([1, 2, 3]))).toThrow(BRUSH_ATLAS_ERROR);
  });
});
