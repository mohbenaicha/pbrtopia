import { describe, expect, it } from 'vitest';
import { loadBaseMaterialsFrom } from '../../../../../src/materialgen/app/panels/masks/loadBaseMaterials';

describe('materialgen/app loadBaseMaterialsFrom (masks R34)', () => {
  it('R34 reads the one data file into the table, in file order', async () => {
    const table = await loadBaseMaterialsFrom({ '/data/base-materials.json': async () => ({ Brick: [0.8, 0, [1, 2, 3]], Steel: [0.3, 1, [4, 5, 6]] }) });
    expect(table.map((entry) => entry.name)).toEqual(['Brick', 'Steel']);
  });

  it('R34 a missing data file is a failure, not an empty table', async () => {
    await expect(loadBaseMaterialsFrom({})).rejects.toThrow();
  });

  it('R34 a data file that is not valid is a failure', async () => {
    await expect(loadBaseMaterialsFrom({ '/data/base-materials.json': async () => ({ Brick: 'x' }) })).rejects.toThrow();
  });
});
