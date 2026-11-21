import { existsSync, readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import baseMaterialsFile from '../../../../src/materialMasks/data/base-materials.json';
import manifest from '../../../../src/materialgen/compositing/atlas/material_balls.json';
import { ballCellOf, ballCutOf } from '@mat/compositing/atlas/loadMaterialBalls';
import { GENERIC, parseBaseMaterials } from '@shared/materialMasks';

describe('materialgen/compositing baked ball sheet (R54)', () => {
  it('R54 the manifest lists Generic first, then every table material once, and the grid holds them all', () => {
    const table = parseBaseMaterials(baseMaterialsFile);
    expect(manifest.names[0]).toBe(GENERIC.name);
    expect(manifest.names.slice(1)).toEqual(table.map((entry) => entry.name));
    expect(new Set(manifest.names).size).toBe(manifest.names.length);
    expect(manifest.columns * manifest.columns).toBeGreaterThanOrEqual(manifest.names.length);
  });

  it('R54 the sheet is a WebP of columns x cell pixels on a side (rebake when the table changes)', () => {
    const path = 'src/materialgen/compositing/atlas/material_balls.webp';
    expect(existsSync(path)).toBe(true);
    const bytes = readFileSync(path);
    expect(bytes.subarray(0, 4).toString('latin1')).toBe('RIFF');
    expect(bytes.subarray(8, 12).toString('latin1')).toBe('WEBP');
    expect(bytes.length).toBeGreaterThan(10_000);
    expect(manifest.cell * manifest.columns).toBe(2048);
  });

  it('R54 a name has the cell of its place in the manifest, and an unknown name has none', () => {
    expect(ballCellOf(GENERIC.name)).toBe(0);
    expect(ballCellOf(manifest.names[41]!)).toBe(41);
    expect(ballCellOf('No such material')).toBeUndefined();
  });

  it('R54 the cut of a cell is its background size and position at a display size, left to right then top to bottom', () => {
    const size = 80;
    const first = ballCutOf(0, size);
    expect(first.backgroundSize).toBe(`${manifest.columns * size}px ${manifest.columns * size}px`);
    expect(first.backgroundPosition).toBe('0px 0px');
    expect(ballCutOf(manifest.columns + 3, size).backgroundPosition).toBe(`${-3 * size}px ${-size}px`);
    expect(first.backgroundImage).toContain('url(');
  });
});
