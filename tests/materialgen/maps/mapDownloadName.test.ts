import { describe, expect, it } from 'vitest';
import { mapDownloadName } from '../../../src/materialgen/maps/mapDownloadName';

describe('materialgen/export R35 mapDownloadName', () => {
  it('R35 names a single-map download <Name>-<map>.png with the map word of its kind', () => {
    const names = (['normal', 'height', 'rough', 'metal', 'ao'] as const).map((kind) => mapDownloadName('Mossy brick', kind, 'albedo'));
    expect(names).toEqual(['Mossy brick-normal-opengl.png', 'Mossy brick-height.png', 'Mossy brick-roughness.png', 'Mossy brick-metallic.png', 'Mossy brick-ao.png']);
  });

  it('R35 the colour map is albedo or diffuse by the colour mode, whichever kind holds it', () => {
    expect(mapDownloadName('Brick', 'albedo', 'albedo')).toBe('Brick-albedo.png');
    expect(mapDownloadName('Brick', 'albedo', 'diffuse')).toBe('Brick-diffuse.png');
    expect(mapDownloadName('Brick', 'diffuse', 'albedo')).toBe('Brick-albedo.png');
  });

  it('R35 characters a file name cannot hold are replaced', () => {
    expect(mapDownloadName('a/b:c', 'height', 'albedo')).toBe('a_b_c-height.png');
  });
});
