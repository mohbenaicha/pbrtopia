import { describe, expect, it, vi } from 'vitest';
import { parseBaseMaterials } from '@shared/materialMasks/table/baseMaterials';
import { chunkDescription } from '@shared/materialMasks/table/chunkDescription';
import { decodeFloat16Vectors } from '@shared/materialMasks/table/float16';
import { keywordMatch, matchBaseMaterials, type Embedder } from '@shared/materialMasks/table/matchMaterials';

const TABLE = parseBaseMaterials({
  'Oak Wood': [0.7, 0, [120, 80, 40]],
  'Pine Wood': [0.8, 0, [200, 160, 100]],
  'Steel': [0.3, 1, [190, 190, 195]],
  'Brick Wall': [0.9, 0, [150, 60, 50]],
  'Gold Leaf': [0.2, 1, [212, 175, 55]],
});
// one vector per material, 4 numbers each: wood-ish, wood-ish, metal, masonry, metal
const VECTORS = [
  Float32Array.of(1, 0.2, 0, 0),
  Float32Array.of(0.9, 0.5, 0, 0),
  Float32Array.of(0, 0, 1, 0),
  Float32Array.of(0, 0, 0, 1),
  Float32Array.of(0, 0, 0.8, 0.5),
];
const embedderFor = (vectorFor: (text: string) => Float32Array): Embedder => ({ embed: async (texts) => texts.map(vectorFor) });

describe('materialgen/masks chunkDescription', () => {
  it('R72 three words or fewer are one chunk, lower-cased and stripped of other characters', () => {
    expect(chunkDescription('Dark Oak!')).toEqual(['dark oak']);
    expect(chunkDescription('  ')).toEqual([]);
  });

  it('R72 longer text gives every 3-word window, then the whole phrase', () => {
    expect(chunkDescription('rusty old iron gate')).toEqual(['rusty old iron', 'old iron gate', 'rusty old iron gate']);
  });
});

describe('materialgen/masks decodeFloat16Vectors', () => {
  it('R75 half-precision values are read as numbers, vector by vector', () => {
    // 1.0 = 0x3C00, -2.0 = 0xC000, 0.5 = 0x3800, 0 = 0x0000, little-endian
    const bytes = Uint8Array.from([0x00, 0x3c, 0x00, 0xc0, 0x00, 0x38, 0x00, 0x00]);
    expect(decodeFloat16Vectors(bytes, 2, 2).map((vector) => Array.from(vector))).toEqual([[1, -2], [0.5, 0]]);
  });

  it('R75 a file of the wrong length is refused', () => {
    expect(() => decodeFloat16Vectors(new Uint8Array(6), 2, 2)).toThrow();
  });
});

describe('materialgen/masks keywordMatch', () => {
  it('R77 each material scores the lower-case words its name shares with the text, ties going to file order', () => {
    const match = keywordMatch('weathered wood planks, old wood', TABLE);
    expect(match.top3).toEqual(['Oak Wood', 'Pine Wood']);
    expect(match.material).toBe('Oak Wood');
    expect(match.kind).toBe('keyword');
  });

  it('R77 a text that shares no word with any name gets Generic and no suggestions', () => {
    expect(keywordMatch('zzz', TABLE)).toEqual({ material: 'Generic', top3: [], kind: 'keyword' });
  });
});

describe('materialgen/masks matchBaseMaterials', () => {
  const texts = ['dark oak planks'];

  it('R78 the default is the material whose vector is nearest, and top3 holds three different names ordered by score', async () => {
    const embedder = embedderFor(() => Float32Array.of(1, 0.1, 0, 0));
    const [match] = await matchBaseMaterials({ texts, table: TABLE, vectors: VECTORS, embedder });
    expect(match).toEqual({ material: 'Oak Wood', top3: ['Oak Wood', 'Pine Wood', 'Steel'], kind: 'embedding' }); // Steel: the third score ties at 0, file order
    expect(new Set(match!.top3).size).toBe(3);
  });

  it('R74 equal scores go to the earlier entry in file order', async () => {
    const embedder = embedderFor(() => Float32Array.of(0, 0, 1, 0)); // Steel scores 1; Gold Leaf 0.85; the rest 0
    const [match] = await matchBaseMaterials({ texts, table: TABLE, vectors: VECTORS, embedder });
    expect(match!.top3[0]).toBe('Steel');
    expect(match!.top3[1]).toBe('Gold Leaf');
    expect(match!.top3[2]).toBe('Oak Wood'); // the zero scores tie: file order
  });

  it('R72 every chunk of every text is embedded, in one call, and each chunk\'s best are pooled, the best score of a name kept, before the top 3', async () => {
    const embed = vi.fn(async (list: string[]) => list.map((text) => (text.includes('steel') ? Float32Array.of(0, 0, 1, 0) : Float32Array.of(0, 0, 0, 1))));
    const [match] = await matchBaseMaterials({ texts: ['steel and brick work'], table: TABLE, vectors: VECTORS, embedder: { embed } });
    expect(embed).toHaveBeenCalledTimes(1);
    expect(embed.mock.calls[0]![0]).toEqual(['steel and brick', 'and brick work', 'steel and brick work']);
    expect(match!.top3).toContain('Steel');
    expect(match!.top3).toContain('Brick Wall');
  });

  it('R77 when the embedder fails every row gets a keyword match and nothing is thrown', async () => {
    const embedder: Embedder = { embed: async () => { throw new Error('files missing'); } };
    const matches = await matchBaseMaterials({ texts: ['dark oak wood', 'rusty steel'], table: TABLE, vectors: VECTORS, embedder });
    expect(matches.map((match) => match.kind)).toEqual(['keyword', 'keyword']);
    expect(matches[0]!.material).toBe('Oak Wood');
    expect(matches[1]!.material).toBe('Steel');
  });

  it('R76 an embedder that is not ready within the time limit is replaced by the keyword match', async () => {
    const embedder: Embedder = { embed: () => new Promise(() => undefined) };
    const matches = await matchBaseMaterials({ texts, table: TABLE, vectors: VECTORS, embedder, timeoutMs: 20 });
    expect(matches[0]!.kind).toBe('keyword');
  });

  it('R77 with no vectors file the keyword match is used at once', async () => {
    const embed = vi.fn();
    const matches = await matchBaseMaterials({ texts, table: TABLE, vectors: null, embedder: { embed } });
    expect(embed).not.toHaveBeenCalled();
    expect(matches[0]!.kind).toBe('keyword');
  });

  it('R74 the same inputs give the same matches', async () => {
    const embedder = embedderFor((text) => Float32Array.of(text.length % 3, 1, 0, 0));
    const first = await matchBaseMaterials({ texts: ['a b c d', 'oak'], table: TABLE, vectors: VECTORS, embedder });
    const second = await matchBaseMaterials({ texts: ['a b c d', 'oak'], table: TABLE, vectors: VECTORS, embedder });
    expect(second).toEqual(first);
  });
});
