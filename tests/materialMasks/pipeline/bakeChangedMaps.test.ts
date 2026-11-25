import { describe, expect, it } from 'vitest';
import { bakeChangedMaps, bakeCurrentRows, type BakedMaps } from '../../../src/materialMasks';
import { runMaskJob } from '../../../src/materialMasks/worker/maskJobs';
import { flatMaps, greyPlane, labelIslandGrid, makeIslandMesh, makeRecord, seededRandom } from '../../support/maskBakeFixtures';
import { rasterizeIslandCoverage } from '../../../src/uvCoverage/rasterizeIslandCoverage';

const SIDE = 64;

function scene(seed: number) {
  const random = seededRandom(seed);
  const labels = labelIslandGrid(SIDE, 4, 0.15, (cell) => (cell % 5 === 4 ? 255 : cell % 4));
  const base: BakedMaps = { rough: greyPlane(SIDE, (index) => (index * 7) % 256), metal: greyPlane(SIDE, (index) => (index * 13) % 256) };
  return { random, labelImage: { width: SIDE, height: SIDE, channels: 1 as const, data: labels }, base, grey: greyPlane(SIDE, (index) => (index * 31) % 256), coverage: rasterizeIslandCoverage(makeIslandMesh(4, 0.15), SIDE) };
}

describe('bakeChangedMaps: the named maps of a bake (mask-bake-session R1, R4)', () => {
  it('mask-bake-session R1 each named map equals that map of the full bake, byte for byte, with feather 0 to 4, grain, base and coverage', () => {
    for (const feather of [0, 1, 2, 4]) {
      const { random, labelImage, base, grey, coverage } = scene(feather + 1);
      const record = makeRecord(4, random, feather, [1, 3]);
      const full = bakeCurrentRows(labelImage, record, grey, 'clamp', base, undefined, coverage);
      for (const maps of [['rough'], ['metal'], ['rough', 'metal']] as const) {
        const got = bakeChangedMaps(labelImage, record, maps, grey, 'clamp', base, undefined, coverage);
        expect(Object.keys(got).sort()).toEqual([...maps].sort());
        for (const which of maps) expect(Array.from(got[which]!.data), `feather ${feather} ${which}`).toEqual(Array.from(full[which].data));
      }
    }
  });

  it('mask-bake-session R1 with no base maps the named map equals the full bake of that map', () => {
    const { random, labelImage, coverage } = scene(9);
    const record = makeRecord(4, random, 2);
    const full = bakeCurrentRows(labelImage, record, undefined, 'clamp', undefined, undefined, coverage);
    const got = bakeChangedMaps(labelImage, record, ['metal'], undefined, 'clamp', undefined, undefined, coverage);
    expect(Array.from(got.metal!.data)).toEqual(Array.from(full.metal.data));
    expect(got.rough).toBeUndefined();
  });

  it('mask-bake-session R4 the job kind bakeMaps gives only the named maps and the same bytes', () => {
    const { random, labelImage, base, coverage } = scene(3);
    const record = makeRecord(4, random, 1);
    const full = bakeCurrentRows(labelImage, record, undefined, 'clamp', base, undefined, coverage);
    const got = runMaskJob('bakeMaps', { labels: labelImage, record, maps: ['rough'], edges: 'clamp', base, coverage });
    expect(Object.keys(got)).toEqual(['rough']);
    expect(Array.from(got.rough!.data)).toEqual(Array.from(full.rough.data));
    expect(flatMaps(SIDE, 0, 0).rough.data.length).toBe(SIDE * SIDE);
  });
});
