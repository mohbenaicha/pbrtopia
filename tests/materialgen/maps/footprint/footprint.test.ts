import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { ImageEdit } from '@mat/maps/mapActions';
import type { MapKind } from '@mat/maps/mapKinds';
import type { MasksCommit } from '@mat/maps/planCommitMasks';
import { createRig, solid, type Cost, type Rig } from './footprintRig';

vi.mock('@mat/maps/png/pngOffThread', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@mat/maps/png/pngOffThread')>();
  return {
    ...actual,
    encodePngBlob: vi.fn(actual.encodePngBlob),
    encodeResizedPngBlob: vi.fn(actual.encodeResizedPngBlob),
    decodePngOffThread: vi.fn(actual.decodePngOffThread),
  };
});

// Maps R72 (the footprint table), R73 (sequences), R74 (known waste). S is 256; pictures are small so everything runs page-side.
const S = 256;
const tile = (kind: MapKind, side = S, value = 100) => ({ kind, image: solid(side, 3, value) });
const edit = (kind: MapKind, value: number): ImageEdit => ({ kind, image: solid(S, 3, value) });
const zero = { written: 0, deleted: 0, encodes: 0, decodes: 0 };
const costOf = ({ written, deleted, encodes, decodes }: Cost) => ({ written, deleted, encodes, decodes });

let rig: Rig;
beforeEach(() => {
  rig = createRig();
});

/** Runs `step` and checks R73 straight after it. */
async function checked(step: Promise<Cost>): Promise<Cost> {
  const cost = await step;
  expect(rig.problems()).toEqual([]);
  return cost;
}
const repeat = async (times: number, step: (index: number) => Promise<Cost>): Promise<Cost[]> => {
  const costs: Cost[] = [];
  for (let index = 0; index < times; index += 1) costs.push(await checked(step(index)));
  return costs;
};
const labelsCommit = (extra: Partial<MasksCommit> = {}): MasksCommit => ({
  labels: { original: solid(300, 3, 7), working: solid(S, 1, 1), derivedFrom: { kind: 'albedo', key: rig.state().maps.albedo!.workingKey } },
  label: 'Material masks',
  ...extra,
});
const bake = (value: number): NonNullable<MasksCommit['bake']> => ({ rough: solid(S, 1, value), metal: solid(S, 1, value + 1) });

describe('materialgen/maps R72 footprint: place, generate, drop', () => {
  it('R72 F1 a tile that is S x S is its own working copy: 1 file, 1 encode', async () => {
    const cost = await checked(rig.place([tile('albedo')]));
    expect(costOf(cost)).toEqual({ written: 1, deleted: 0, encodes: 1, decodes: 0 });
    expect(cost.commits).toBe(1);
    expect(rig.state().maps.albedo!.workingKey).toBe(rig.state().maps.albedo!.originalKey);
  });

  it('R72 F2 a tile of another size: native original and resampled working, 2 files, 2 encodes', async () => {
    const cost = await checked(rig.place([tile('albedo', 300)]));
    expect(costOf(cost)).toEqual({ written: 2, deleted: 0, encodes: 2, decodes: 0 });
    expect(rig.state().size).toBe(S);
  });

  it('R72 F3 a regenerate over a map with original, working and undo removes all three', async () => {
    await rig.place([tile('albedo', 300)]);
    await rig.edit([edit('albedo', 1)]);
    await rig.edit([edit('albedo', 2)]);
    expect(rig.files.size).toBe(3);
    const cost = await checked(rig.place([tile('albedo', S, 9)]));
    expect(costOf(cost)).toEqual({ written: 1, deleted: 3, encodes: 1, decodes: 0 });
    expect(rig.files.size).toBe(1);
    expect(rig.state().maps.albedo!.undoKey).toBeNull();
  });

  it('R72 F4 several maps generated in one plan are one commit and cost the sum of their rows', async () => {
    const cost = await checked(rig.place([tile('albedo'), tile('normal', 300), tile('height')]));
    expect(costOf(cost)).toEqual({ written: 1 + 2 + 1, deleted: 0, encodes: 1 + 2 + 1, decodes: 0 });
    expect(cost.commits).toBe(1);
  });

  it('R72 F5 a drop on an empty slot costs as a place', async () => {
    expect(costOf(await checked(rig.drop('normal', solid(S, 3))))).toEqual({ written: 1, deleted: 0, encodes: 1, decodes: 0 });
    expect(costOf(await checked(rig.drop('height', solid(300, 3))))).toEqual({ written: 2, deleted: 0, encodes: 2, decodes: 0 });
  });

  it('R72 F6 a drop on a filled map writes one working file; the old undo goes only when it is distinct', async () => {
    await rig.place([tile('albedo')]);
    const costs = await repeat(3, () => rig.drop('albedo', solid(S, 3, 50)));
    expect(costs.map(costOf)).toEqual([
      { written: 1, deleted: 0, encodes: 1, decodes: 0 }, // undo = the original
      { written: 1, deleted: 0, encodes: 1, decodes: 0 }, // the old undo is still the original
      { written: 1, deleted: 1, encodes: 1, decodes: 0 }, // the old undo was a distinct working file
    ]);
  });
});

describe('materialgen/maps R72 footprint: edits, undo, restore, clear', () => {
  it('R72 F7 an edit writes one working file; the old undo goes only when it is distinct', async () => {
    await rig.place([tile('albedo')]);
    const costs = await repeat(3, (index) => rig.edit([edit('albedo', index)]));
    expect(costs.map(costOf)).toEqual([
      { written: 1, deleted: 0, encodes: 1, decodes: 0 },
      { written: 1, deleted: 0, encodes: 1, decodes: 0 },
      { written: 1, deleted: 1, encodes: 1, decodes: 0 },
    ]);
    expect(rig.files.size).toBe(3);
  });

  it('R72 F8 a computed map into an empty slot is one file that is original and working', async () => {
    await rig.place([tile('height')]);
    const cost = await checked(rig.edit([{ kind: 'ao', image: solid(S, 1, 4), derivedFrom: { kind: 'height', key: rig.state().maps.height!.workingKey } }], 'Compute AO'));
    expect(costOf(cost)).toEqual({ written: 1, deleted: 0, encodes: 1, decodes: 0 });
    expect(rig.state().maps.ao!.workingKey).toBe(rig.state().maps.ao!.originalKey);
  });

  it('R72 F9 a grouped edit of N maps writes N files in one commit and releases N old undos once they are distinct', async () => {
    await rig.place([tile('albedo'), tile('normal'), tile('height')]);
    const kinds: MapKind[] = ['albedo', 'normal', 'height'];
    const costs = await repeat(3, (index) => rig.edit(kinds.map((kind) => edit(kind, index)), 'Mirror', true));
    expect(costs.map(costOf)).toEqual([
      { written: 3, deleted: 0, encodes: 3, decodes: 0 },
      { written: 3, deleted: 0, encodes: 3, decodes: 0 },
      { written: 3, deleted: 3, encodes: 3, decodes: 0 },
    ]);
    expect(costs.every((cost) => cost.commits === 1)).toBe(true);
  });

  it('R72 F10 undo writes and encodes nothing and releases the undone working file', async () => {
    await rig.place([tile('albedo')]);
    await rig.edit([edit('albedo', 1)]);
    await rig.edit([edit('albedo', 2)]);
    expect(costOf(await checked(rig.undo(['albedo'])))).toEqual({ ...zero, deleted: 1 });
    expect(rig.state().maps.albedo!.undoKey).toBeNull();
  });

  it('R72 F11 undo of a group of N maps releases N working files', async () => {
    await rig.place([tile('albedo'), tile('normal'), tile('height')]);
    const kinds: MapKind[] = ['albedo', 'normal', 'height'];
    await rig.edit(kinds.map((kind) => edit(kind, 1)), 'Crop', true);
    await rig.edit(kinds.map((kind) => edit(kind, 2)), 'Crop', true);
    expect(costOf(await checked(rig.undo(['albedo'])))).toEqual({ ...zero, deleted: 3 });
  });

  it('R72 F12 restoring an original that is S x S reads it once and writes nothing', async () => {
    await rig.place([tile('albedo')]);
    await rig.edit([edit('albedo', 1)]);
    await rig.edit([edit('albedo', 2)]);
    expect(costOf(await checked(rig.restore('albedo')))).toEqual({ written: 0, deleted: 1, encodes: 0, decodes: 1 });
  });

  it('R72 F13 restoring an original of another size writes one resampled file', async () => {
    await rig.place([tile('albedo', 300)]);
    await rig.edit([edit('albedo', 1)]);
    expect(costOf(await checked(rig.restore('albedo')))).toEqual({ written: 1, deleted: 1, encodes: 1, decodes: 1 });
  });

  it('R72 F14 restoring again right after a restore costs nothing and keeps the undo', async () => {
    await rig.place([tile('albedo', 300)]);
    await rig.edit([edit('albedo', 1)]);
    await rig.restore('albedo');
    const undoKey = rig.state().maps.albedo!.undoKey;
    expect(costOf(await checked(rig.restore('albedo')))).toEqual(zero);
    expect(rig.state().maps.albedo!.undoKey).toBe(undoKey);
  });

  it('R72 F15 clearing a slot removes its distinct files; the last clear unsets S', async () => {
    await rig.place([tile('albedo', 300), tile('normal')]);
    await rig.edit([edit('albedo', 1)]);
    await rig.edit([edit('albedo', 2)]);
    expect(costOf(await checked(rig.clear('albedo')))).toEqual({ ...zero, deleted: 3 });
    expect(rig.state().size).toBe(S);
    expect(costOf(await checked(rig.clear('normal')))).toEqual({ ...zero, deleted: 1 });
    expect(rig.state().size).toBeNull();
    expect(rig.files.size).toBe(0);
  });
});

describe('materialgen/maps R72 footprint: change of S', () => {
  it('R72 F16 a change of S decodes, resamples and writes one file per map; old undos go once they are distinct', async () => {
    await rig.place([tile('albedo'), tile('normal'), tile('height')]);
    const costs = await repeat(3, (index) => rig.changeSize(index % 2 === 0 ? 512 : 256));
    expect(costs.map(costOf)).toEqual([
      { written: 3, deleted: 0, encodes: 3, decodes: 3 },
      { written: 3, deleted: 0, encodes: 3, decodes: 3 },
      { written: 3, deleted: 3, encodes: 3, decodes: 3 },
    ]);
  });

  it('R72 F17 a change to the S already set costs nothing', async () => {
    await rig.place([tile('albedo')]);
    expect(costOf(await checked(rig.changeSize(S)))).toEqual(zero);
  });
});

describe('materialgen/maps R72 footprint: masks', () => {
  beforeEach(async () => {
    await rig.place([tile('albedo')]);
  });

  it('R72 F18 the first bake stores rough and metal as one file each', async () => {
    await rig.masks({ ...labelsCommit(), label: 'Material masks' });
    const cost = await checked(rig.masks({ bake: bake(10), label: 'Material masks' }));
    expect(costOf(cost)).toEqual({ written: 2, deleted: 0, encodes: 2, decodes: 0 });
    expect(rig.state().maps.rough!.workingKey).toBe(rig.state().maps.rough!.originalKey);
  });

  it('R72 F19 a later bake writes two files and releases the old undos once they are distinct', async () => {
    await rig.masks(labelsCommit());
    await rig.masks({ bake: bake(10), label: 'Material masks' });
    const costs = await repeat(3, (index) => rig.masks({ bake: bake(20 + 2 * index), label: 'Material masks' }));
    expect(costs.map(costOf)).toEqual([
      { written: 2, deleted: 0, encodes: 2, decodes: 0 },
      { written: 2, deleted: 0, encodes: 2, decodes: 0 },
      { written: 2, deleted: 2, encodes: 2, decodes: 0 },
    ]);
  });

  it('R72 F20 labels from a model run are two files with no undo; a second run releases the first labels', async () => {
    const first = await checked(rig.masks({ ...labelsCommit(), bake: bake(10) }));
    expect(costOf(first)).toEqual({ written: 4, deleted: 0, encodes: 4, decodes: 0 });
    const second = await checked(rig.masks({ ...labelsCommit(), bake: bake(30) }));
    expect(costOf(second)).toEqual({ written: 4, deleted: 2, encodes: 4, decodes: 0 });
    expect(rig.state().maps.labels!.undoKey).toBeNull();
  });

  it('R72 F21 labels rebuilt at a new S write one working file and keep the raw original', async () => {
    await rig.masks({ ...labelsCommit(), bake: bake(10) });
    const rawKey = rig.state().maps.labels!.originalKey;
    await rig.changeSize(512);
    const cost = await checked(rig.masks({
      labels: { keepOriginal: true, working: solid(512, 1, 1), derivedFrom: { kind: 'albedo', key: rig.state().maps.albedo!.workingKey } },
      bake: { rough: solid(512, 1, 11), metal: solid(512, 1, 12) },
      label: 'Material masks',
    }));
    expect(rig.state().maps.labels!.originalKey).toBe(rawKey);
    expect(cost.written).toBe(1 + 2); // the labels working file and the bake
    expect(cost.encodes).toBe(1 + 2);
  });
});

describe('materialgen/maps R72 footprint: missing files and failures', () => {
  it('R72 F22 a missing undo file drops its group; the readable undo files are deleted at once, not left as orphans', async () => {
    await rig.place([tile('albedo'), tile('normal')]);
    await rig.edit([edit('albedo', 1), edit('normal', 1)]);
    await rig.changeSize(512);
    const lost = rig.state().maps.albedo!.undoKey!;
    const kept = rig.state().maps.normal!.undoKey!;
    const cost = await checked(rig.missing([lost]));
    expect(rig.files.has(kept)).toBe(false);
    expect(cost.written).toBe(0);
    expect(cost.deleted).toBe(2); // the lost file itself, and the readable undo of the other member
  });

  it('R72 a failed record commit removes the files already written and leaves the record as it was', async () => {
    await rig.place([tile('albedo')]);
    const before = [...rig.files.keys()];
    const state = rig.state();
    rig.failNextCommit();
    await rig.edit([edit('albedo', 5)]);
    expect([...rig.files.keys()]).toEqual(before);
    expect(rig.state()).toBe(state);
    expect(rig.problems()).toEqual([]);
  });
});

describe('materialgen/maps R73 sequences keep stored files equal to referenced files', () => {
  it('R73 a fixed pseudo-random order of every operation never leaves an orphan, a dangling key or a fourth file', async () => {
    let seed = 20261111;
    const next = (limit: number): number => {
      seed = (seed * 1664525 + 1013904223) % 4294967296;
      return Math.floor((seed / 4294967296) * limit);
    };
    const kinds: MapKind[] = ['albedo', 'normal', 'height', 'ao', 'rough', 'metal'];
    const filled = (): MapKind[] => kinds.filter((kind) => rig.state().maps[kind] !== undefined);
    const side = (): number => rig.state().size ?? S;
    const operations: Array<() => Promise<Cost> | null> = [
      () => { const kind = kinds[next(kinds.length)]!; return rig.place([tile(kind, next(2) === 0 ? side() : 300, next(200))]); },
      () => { const kind = kinds[next(kinds.length)]!; return rig.drop(kind, solid(next(2) === 0 ? side() : 300, 3, next(200))); },
      () => { const have = filled(); return have.length === 0 ? null : rig.edit([{ kind: have[next(have.length)]!, image: solid(side(), 3, next(200)) }]); },
      () => { const have = filled(); return have.length === 0 ? null : rig.edit(have.map((kind) => ({ kind, image: solid(side(), 3, next(200)) })), 'Mirror', true); },
      () => { const have = filled(); return have.length === 0 ? null : rig.undo([have[next(have.length)]!]); },
      () => { const have = filled(); return have.length === 0 ? null : rig.restore(have[next(have.length)]!); },
      () => { const have = filled(); return have.length === 0 ? null : rig.clear(have[next(have.length)]!); },
      () => (filled().length === 0 ? null : rig.changeSize(next(2) === 0 ? 256 : 512)),
      () => (rig.state().maps.albedo === undefined ? null : rig.masks({ ...labelsCommit(), labels: { ...labelsCommit().labels!, working: solid(side(), 1, 1) }, bake: { rough: solid(side(), 1, next(200)), metal: solid(side(), 1, next(200)) } })),
      () => (rig.state().maps.labels === undefined ? null : rig.masks({ bake: { rough: solid(side(), 1, next(200)), metal: solid(side(), 1, next(200)) }, label: 'Material masks' })),
    ];
    let performed = 0;
    for (let step = 0; step < 120; step += 1) {
      const running = operations[next(operations.length)]!();
      if (running === null) continue;
      await running;
      performed += 1;
      expect(rig.problems(), `after step ${step}`).toEqual([]);
    }
    expect(performed).toBeGreaterThan(60);
  });
});

describe('materialgen/maps R74 known waste (pinned so a change of it is seen)', () => {
  it('R74 W1 a bake with the very same pixels still writes two files and replaces the undo', async () => {
    await rig.place([tile('albedo')]);
    await rig.masks(labelsCommit());
    await rig.masks({ bake: bake(10), label: 'Material masks' });
    const cost = await checked(rig.masks({ bake: bake(10), label: 'Material masks' }));
    expect(cost.written).toBe(2);
  });

  it('R74 W2 a change of S resamples rough and metal although the next masks change rebuilds them', async () => {
    await rig.place([tile('albedo')]);
    await rig.masks({ ...labelsCommit(), bake: bake(10) });
    const cost = await checked(rig.changeSize(512));
    expect(cost.written).toBe(3); // albedo, rough, metal (labels is left for the masks step)
  });

  it('R74 W3 a delete that fails leaves the old file stored until the next sweep', async () => {
    await rig.place([tile('albedo')]);
    await rig.edit([edit('albedo', 1)]);
    await rig.edit([edit('albedo', 2)]);
    rig.failDeletes();
    await rig.edit([edit('albedo', 3)]);
    expect(rig.problems()).toHaveLength(1);
    expect(rig.problems()[0]).toMatch(/orphan file/);
  });
});
