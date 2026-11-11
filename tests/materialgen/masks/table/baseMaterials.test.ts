import { describe, expect, it } from 'vitest';
import { GENERIC, parseBaseMaterials, listMaterialOptions, findMaterial } from '@mat/masks/table/baseMaterials';

const FILE = {
  'Oak Wood': [0.7, 0, [120, 80, 40]],
  'Steel': [0.3, 1, [190, 190, 195]],
  'Brick': [0.9, 0, [150, 60, 50]],
  'Gold': [0.2, 1, [212, 175, 55]],
  'Granite': [0.6, 0, [110, 110, 115]],
};

describe('materialgen/masks base materials', () => {
  it('R34 the file is read into entries in file order, with roughness, metal and colour', () => {
    const table = parseBaseMaterials(FILE);
    expect(table.map((entry) => entry.name)).toEqual(['Oak Wood', 'Steel', 'Brick', 'Gold', 'Granite']);
    expect(table[1]).toEqual({ name: 'Steel', roughness: 0.3, metal: 1, rgb: [190, 190, 195] });
  });

  it('R34 a value outside 0 to 1, a colour that is not three whole numbers of 0 to 255, or an empty name is refused', () => {
    expect(() => parseBaseMaterials({ A: [1.2, 0, [1, 2, 3]] })).toThrow();
    expect(() => parseBaseMaterials({ A: [0.5, -0.1, [1, 2, 3]] })).toThrow();
    expect(() => parseBaseMaterials({ A: [0.5, 0, [1, 2, 300]] })).toThrow();
    expect(() => parseBaseMaterials({ A: [0.5, 0, [1, 2]] })).toThrow();
    expect(() => parseBaseMaterials({ A: [0.5, 0, [1.5, 2, 3]] })).toThrow();
    expect(() => parseBaseMaterials({ '': [0.5, 0, [1, 2, 3]] })).toThrow();
    expect(() => parseBaseMaterials([])).toThrow();
  });

  it('R13 Generic is rough 0.5, metal 0, grey 128 and is not part of the file', () => {
    expect(GENERIC).toEqual({ name: 'Generic', roughness: 0.5, metal: 0, rgb: [128, 128, 128] });
    expect(parseBaseMaterials(FILE).some((entry) => entry.name === 'Generic')).toBe(false);
  });

  it('R39 a material is found by name, Generic included', () => {
    const table = parseBaseMaterials(FILE);
    expect(findMaterial(table, 'Gold')?.roughness).toBe(0.2);
    expect(findMaterial(table, 'Generic')).toBe(GENERIC);
    expect(findMaterial(table, 'Nothing')).toBeUndefined();
  });

  it('R37 the select lists the top 3 first as Suggested, then Generic, then every name alphabetically, each with its values', () => {
    const table = parseBaseMaterials(FILE);
    const options = listMaterialOptions(table, ['Gold', 'Brick', 'Steel'], '');
    expect(options.map((option) => [option.name, option.suggested])).toEqual([
      ['Gold', true], ['Brick', true], ['Steel', true], ['Generic', false], ['Brick', false], ['Gold', false], ['Granite', false], ['Oak Wood', false], ['Steel', false],
    ]);
    expect(options[0]).toMatchObject({ roughness: 0.2, metal: 1 });
  });

  it('R37 typing filters by a case-insensitive part of the name, and no match gives an empty list', () => {
    const table = parseBaseMaterials(FILE);
    expect(listMaterialOptions(table, ['Gold'], 'OAK').map((option) => option.name)).toEqual(['Oak Wood']);
    expect(listMaterialOptions(table, [], 'gen').map((option) => option.name)).toEqual(['Generic']);
    expect(listMaterialOptions(table, [], 'zzz')).toEqual([]);
  });
});
