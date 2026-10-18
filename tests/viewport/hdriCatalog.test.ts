import { describe, expect, it } from 'vitest';
import { HDRI_CHOICES, hdriUrl } from '../../src/viewport/hdriCatalog';

describe('HDRI catalog', () => {
  it('R14 it offers the built-in studio first and then the five copied HDRIs with plain names', () => {
    expect(HDRI_CHOICES.map((choice) => choice.id)).toEqual(['studio', 'studio_small_09', 'kloofendal_48d_partly_cloudy_puresky', 'overcast_soil_puresky', 'venice_sunset', 'moonless_golf']);
    expect(HDRI_CHOICES.map((choice) => choice.label)).toEqual(['Studio (built-in)', 'Photo studio', 'Partly cloudy sky', 'Overcast sky', 'Venice sunset', 'Moonless night']);
  });

  it('R14 a file HDRI has a url under hdri/ and the built-in studio has none', () => {
    expect(hdriUrl('venice_sunset')).toMatch(/hdri\/venice_sunset\.hdr$/);
    expect(hdriUrl('studio')).toBeUndefined();
  });

  it('R14 an id that is not in the catalog has no url, so it can never be fetched from user input', () => {
    expect(hdriUrl('../secret')).toBeUndefined();
    expect(hdriUrl('missing')).toBeUndefined();
  });
});
