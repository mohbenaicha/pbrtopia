import { describe, expect, it } from 'vitest';
import { findChangedMaps, rowsToBake, type BakeRow, type MapName, type PixelImage } from '../../../src/materialMasks';
import { bakeNamedMasks } from '../../../src/materialMasks/bake/bakeMasks';
import { dilateGutterPlanes } from '../../../src/materialMasks/bake/dilateGutter';
import { BakeSessionState } from '../../../src/materialMasks/worker/bakeSessionState';
import { rasterizeIslandCoverage } from '../../../src/uvCoverage/rasterizeIslandCoverage';
import { greyPlane, labelIslandGrid, makeIslandMesh, makeRecord, seededRandom } from '../../support/maskBakeFixtures';

const SIDE = 192; // gutter reach 3
const TILE = 32;
const ROWS = 4;

const image = (data: Uint8Array): PixelImage => ({ width: SIDE, height: SIDE, channels: 1, data });
const randomPlane = (random: () => number): Uint8Array => Uint8Array.from({ length: SIDE * SIDE }, () => Math.floor(random() * 256));

/** Random rectangles that overlap and touch, so labels meet across tile edges (the blur crosses labels) and gutter texels sit beside island texels of other tiles; some gutter texels carry a label. */
function rectangleScene(random: () => number): { labels: Uint8Array; coverage: Uint8Array } {
  const labels = new Uint8Array(SIDE * SIDE).fill(255);
  const coverage = new Uint8Array(SIDE * SIDE);
  for (let rect = 0; rect < 28; rect += 1) {
    const w = 8 + Math.floor(random() * 50);
    const h = 8 + Math.floor(random() * 50);
    const x0 = Math.floor(random() * (SIDE - w));
    const y0 = Math.floor(random() * (SIDE - h));
    const label = random() < 0.15 ? 255 : Math.floor(random() * (ROWS + 2)); // 4 and 5 have no row: they read row 0
    for (let y = y0; y < y0 + h; y += 1) {
      for (let x = x0; x < x0 + w; x += 1) {
        labels[y * SIDE + x] = label;
        coverage[y * SIDE + x] = 1;
      }
    }
  }
  for (let spot = 0; spot < 400; spot += 1) {
    const at = Math.floor(random() * SIDE * SIDE);
    if (coverage[at] === 0) labels[at] = Math.floor(random() * ROWS);
  }
  return { labels, coverage };
}

function scene(seed: number) {
  const random = seededRandom(seed);
  // cell 3 holds label 5, which has no row (it reads row 0); cells with index 4 mod 5 hold no mask (255)
  const { labels, coverage } = seed % 2 === 1
    ? rectangleScene(random)
    : { labels: labelIslandGrid(SIDE, 4, 0.15, (cell) => (cell === 3 ? 5 : cell % 5 === 4 ? 255 : cell % 4)), coverage: rasterizeIslandCoverage(makeIslandMesh(4, 0.15), SIDE) };
  const maps = { rough: randomPlane(random), metal: randomPlane(random) };
  const grey = greyPlane(SIDE, () => Math.floor(random() * 256)).data;
  const rows = rowsToBake(makeRecord(ROWS, random, 1).rows);
  return { random, labels, coverage, maps, grey, rows };
}

/** A session started from copies, as the page's start message moves them. */
const openState = (labels: Uint8Array, maps: { rough: Uint8Array; metal: Uint8Array }, coverage: Uint8Array | undefined): BakeSessionState =>
  new BakeSessionState({ size: SIDE, labels: labels.slice(), maps: { rough: maps.rough.slice(), metal: maps.metal.slice() }, ...(coverage === undefined ? {} : { coverage: coverage.slice() }) }, { tile: TILE });

/** What a full bake gives for the named maps from the maps as they are now: the reference of mask-bake-session R1. */
function fullBake(labels: Uint8Array, rows: BakeRow[], feather: number, grey: Uint8Array | null, coverage: Uint8Array | undefined, maps: { rough: Uint8Array; metal: Uint8Array }, named: MapName[]) {
  const baked = bakeNamedMasks({ labels: image(labels), rows, feather, ...(grey === null ? {} : { grey: image(grey) }), edges: 'clamp', base: { rough: image(maps.rough), metal: image(maps.metal) } }, named);
  const planes = named.map((which) => baked[which]!);
  const filled = coverage === undefined ? planes : dilateGutterPlanes(planes, coverage);
  return Object.fromEntries(named.map((which, index) => [which, filled[index]!.data])) as Partial<Record<MapName, Uint8Array>>;
}

type Step = (rows: BakeRow[], random: () => number, withGrey: boolean) => { rows: BakeRow[]; feather?: number };

const label = (random: () => number): number => Math.floor(random() * ROWS);
const setRow = (rows: BakeRow[], at: number, patch: Partial<BakeRow>): BakeRow[] => rows.map((row, index) => (index === at ? { ...row, ...patch } : row));
const STEPS: Step[] = [
  (rows, random) => ({ rows: setRow(rows, label(random), { rough: Math.round(random() * 100) / 100 }) }),
  (rows, random) => ({ rows: setRow(rows, label(random), { metal: Math.round(random() * 100) / 100 }) }),
  (rows, random) => ({ rows: setRow(rows, label(random), { rough: Math.round(random() * 100) / 100, metal: Math.round(random() * 100) / 100 }) }),
  (rows, random) => ({ rows: setRow(rows, 0, { rough: Math.round(random() * 100) / 100 }) }), // row 0 is read by the label with no row
  (rows, random) => ({ rows, feather: Math.floor(random() * 5) }),
  (rows, random, withGrey) => {
    const at = label(random);
    return { rows: withGrey ? setRow(rows, at, rows[at]!.mix === undefined ? { mix: { invert: random() < 0.5, rough: 0.6, metal: 0.4 } } : { mix: undefined as never }) : rows };
  },
];

function runSequence(seed: number, tile = TILE): { regionEdits: number } {
  const { random, labels, coverage, maps, grey, rows: startRows } = scene(seed);
  const state = new BakeSessionState({ size: SIDE, labels: labels.slice(), maps: { rough: maps.rough.slice(), metal: maps.metal.slice() }, coverage, ...(seed % 2 === 0 ? { grey: grey.slice() } : {}) }, { tile });
  let greyNow: Uint8Array | null = seed % 2 === 0 ? grey : null;
  let rows = startRows;
  let feather = 1;
  const reference: { rough: Uint8Array; metal: Uint8Array } = { rough: maps.rough.slice(), metal: maps.metal.slice() };
  let regionEdits = 0;
  const count = 1 + Math.floor(random() * 5);
  for (let step = 0; step < count + 6; step += 1) {
    if (random() < 0.2) {
      greyNow = greyNow === null ? grey : null; // the grey added or removed between edits
      state.setGrey(greyNow === null ? null : greyNow.slice());
    }
    const next = STEPS[Math.floor(random() * STEPS.length)]!(rows, random, greyNow !== null);
    const nextFeather = next.feather ?? feather;
    const changed = findChangedMaps({ rows, feather }, { rows: next.rows, feather: nextFeather });
    rows = next.rows;
    feather = nextFeather;
    if (changed === null) continue;
    const got = state.edit({ rows, feather, maps: changed.maps, changedLabels: changed.labels });
    expect(Object.keys(got).sort()).toEqual([...changed.maps].sort());
    const want = fullBake(labels, rows, feather, greyNow, coverage, reference, changed.maps);
    for (const which of changed.maps) {
      expect(Array.from(got[which]!), `seed ${seed} step ${step} ${which}`).toEqual(Array.from(want[which]!));
      reference[which] = want[which]!;
    }
    if (state.lastEdit().path === 'region') regionEdits += 1;
  }
  return { regionEdits };
}

describe('BakeSessionState (mask-bake-session R1, R5, R7, R9)', () => {
  it('mask-bake-session R1 every map an edit changes equals the full bake byte for byte over 30 random edit sequences, from a start with random maps, with the grey added and removed between edits', () => {
    let regionEdits = 0;
    for (let seed = 1; seed <= 30; seed += 1) regionEdits += runSequence(seed).regionEdits;
    expect(regionEdits).toBeGreaterThan(10); // the dirty-region path was exercised, not only the full one
  }, 120000);

  it('mask-bake-session R7 R9 at feather 0 (no blur growth) a region edit still refills the gutter beside a changed island across a tile edge, equal to the full bake', () => {
    for (const feather of [0, 4]) {
      for (const seed of [1, 3, 5, 7, 9, 11]) {
        const { random, labels, coverage, maps, rows: startRows } = scene(seed);
        const state = openState(labels, maps, coverage);
        const reference: { rough: Uint8Array; metal: Uint8Array } = { rough: maps.rough.slice(), metal: maps.metal.slice() };
        let rows = startRows;
        const first = state.edit({ rows, feather, maps: ['rough'], changedLabels: 'all' });
        reference.rough = fullBake(labels, rows, feather, null, coverage, reference, ['rough']).rough!;
        expect(Array.from(first.rough!)).toEqual(Array.from(reference.rough));
        for (let edit = 0; edit < 5; edit += 1) {
          const at = label(random);
          rows = setRow(rows, at, { rough: Math.round(random() * 100) / 100 });
          const got = state.edit({ rows, feather, maps: ['rough'], changedLabels: [at] }).rough!;
          expect(state.lastEdit().path).toBe('region');
          reference.rough = fullBake(labels, rows, feather, null, coverage, reference, ['rough']).rough!;
          expect(Array.from(got), `feather ${feather} seed ${seed} edit ${edit}`).toEqual(Array.from(reference.rough));
        }
      }
    }
  });

  it('mask-bake-session R7 the first edit of a map recomputes every texel, and a later one of a single label recomputes a region smaller than the picture', () => {
    const { labels, coverage, maps, rows } = scene(2);
    const state = openState(labels, maps, coverage);
    state.edit({ rows, feather: 1, maps: ['rough'], changedLabels: [1] });
    expect(state.lastEdit().path).toBe('full');
    state.edit({ rows: setRow(rows, 1, { rough: 0.123 }), feather: 1, maps: ['rough'], changedLabels: [1] });
    expect(state.lastEdit().path).toBe('region');
    expect(state.lastEdit().share).toBeGreaterThan(0);
    expect(state.lastEdit().share).toBeLessThan(0.75);
  });

  it('mask-bake-session R7 the metal map is a separate consistent flag: its first edit is full even after the roughness map has a region edit', () => {
    const { labels, coverage, maps, rows } = scene(4);
    const state = openState(labels, maps, coverage);
    state.edit({ rows, feather: 1, maps: ['rough'], changedLabels: [1] });
    state.edit({ rows: setRow(rows, 1, { metal: 0.9 }), feather: 1, maps: ['metal'], changedLabels: [1] });
    expect(state.lastEdit().path).toBe('full');
  });

  it('mask-bake-session R7 a grey added, removed or replaced makes the next edit of each map full again', () => {
    const { labels, coverage, maps, rows, grey } = scene(5);
    const state = openState(labels, maps, coverage);
    state.edit({ rows, feather: 1, maps: ['rough'], changedLabels: [1] });
    state.edit({ rows: setRow(rows, 1, { rough: 0.2 }), feather: 1, maps: ['rough'], changedLabels: [1] });
    expect(state.lastEdit().path).toBe('region');
    state.setGrey(grey);
    state.edit({ rows: setRow(rows, 1, { rough: 0.3 }), feather: 1, maps: ['rough'], changedLabels: [1] });
    expect(state.lastEdit().path).toBe('full');
  });

  it('mask-bake-session R7 a feather change or an all-label change recomputes every texel', () => {
    const { labels, coverage, maps, rows } = scene(6);
    const state = openState(labels, maps, coverage);
    state.edit({ rows, feather: 1, maps: ['rough'], changedLabels: [1] });
    state.edit({ rows, feather: 3, maps: ['rough'], changedLabels: 'all' });
    expect(state.lastEdit().path).toBe('full');
  });

  it('mask-bake-session R6 a reply is a fresh copy: changing it does not change what the session holds for the next edit', () => {
    const { labels, coverage, maps, rows } = scene(7);
    const state = openState(labels, maps, coverage);
    const first = state.edit({ rows, feather: 1, maps: ['rough'], changedLabels: 'all' }).rough!;
    const kept = first.slice();
    first.fill(0);
    const again = state.edit({ rows: setRow(rows, 1, { rough: 0.77 }), feather: 1, maps: ['rough'], changedLabels: [1] }).rough!;
    const want = fullBake(labels, setRow(rows, 1, { rough: 0.77 }), 1, null, coverage, { rough: kept, metal: maps.metal }, ['rough']).rough!;
    expect(Array.from(again)).toEqual(Array.from(want));
  });

  it('mask-bake-session R1 a session with no coverage gives the full bake with no gutter fill', () => {
    const { labels, maps, rows } = scene(8);
    const state = openState(labels, maps, undefined);
    const got = state.edit({ rows, feather: 2, maps: ['rough', 'metal'], changedLabels: 'all' });
    const want = fullBake(labels, rows, 2, null, undefined, maps, ['rough', 'metal']);
    expect(Array.from(got.rough!)).toEqual(Array.from(want.rough!));
    expect(Array.from(got.metal!)).toEqual(Array.from(want.metal!));
  });
});
