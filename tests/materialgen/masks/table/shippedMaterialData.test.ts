import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { parseBaseMaterials } from '@mat/masks/table/baseMaterials';
import { decodeFloat16Vectors } from '@mat/masks/table/float16';

const dataDir = path.resolve(import.meta.dirname, '../../../../src/materialgen/data');
const table = parseBaseMaterials(JSON.parse(readFileSync(path.join(dataDir, 'base-materials.json'), 'utf8')));
const vectors = decodeFloat16Vectors(new Uint8Array(readFileSync(path.join(dataDir, 'material-vectors.bin'))), table.length, 384);

describe('materialgen/masks shipped material data', () => {
  it('R34 the base-material file holds the 1000 materials of Materialize, Copper first', () => {
    expect(table).toHaveLength(1000);
    expect(table[0]).toMatchObject({ name: 'Copper', roughness: 0.12, metal: 1 });
  });

  it('R75 the vectors file is one 384-number vector per material, in the order of the names', () => {
    expect(vectors).toHaveLength(table.length);
    expect(vectors[0]).toHaveLength(384);
  });

  it('R75 R74 the vectors are unit length (sentence embeddings), so the cosine score is comparable across materials', () => {
    for (const vector of vectors) expect(Math.sqrt(vector.reduce((sum, value) => sum + value * value, 0))).toBeCloseTo(1, 1);
  });
});
