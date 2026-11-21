import { describe, expect, it } from 'vitest';
import {
  canUndo,
  changeSize,
  checkMapsInvariants,
  clearMap,
  editMaps,
  isStale,
  nearestMaterialSize,
  placeMap,
  referencedMapKeys,
  restoreOriginal,
  undoMaps,
  undoTargets,
} from '../../../src/materialgen/maps/mapOperations';
import type { MapsState } from '../../../src/materialgen/maps';

const empty: MapsState = { size: null, maps: {} };
const image = (key: string, side = 1024, workingKey = key) => ({ originalKey: key, workingKey, width: side, height: side });
const total = (state: MapsState): number => referencedMapKeys(state).size;

describe('materialgen/maps R15 nearestMaterialSize', () => {
  it('R15 picks the allowed size nearest to the longer side by ratio, clamped at both ends', () => {
    expect(nearestMaterialSize(1920)).toBe(2048);
    expect(nearestMaterialSize(1024)).toBe(1024);
    expect(nearestMaterialSize(724)).toBe(512);
    expect(nearestMaterialSize(725)).toBe(1024);
    expect(nearestMaterialSize(100)).toBe(256);
    expect(nearestMaterialSize(9000)).toBe(2048);
  });
});

describe('materialgen/maps R12 R14 R15 placeMap', () => {
  it('R12 R15 the first image sets S from its longer side and is its own working map when it is S x S', () => {
    const next = placeMap(empty, 'albedo', image('a1'));
    expect(next.size).toBe(1024);
    expect(next.maps.albedo).toMatchObject({ originalKey: 'a1', workingKey: 'a1', undoKey: null });
  });

  it('R39 R15 a 1920 x 1080 first image makes S 2048 and keeps the original at its native size', () => {
    const next = placeMap(empty, 'albedo', { originalKey: 'o', workingKey: 'w', width: 1920, height: 1080 });
    expect(next.size).toBe(2048);
    expect(next.maps.albedo).toMatchObject({ originalKey: 'o', workingKey: 'w', width: 1920, height: 1080 });
  });

  it('R15 an image placed while S is already set leaves S alone', () => {
    const next = placeMap({ size: 512, maps: {} }, 'normal', image('n1', 2048, 'n1w'));
    expect(next.size).toBe(512);
  });

  it('R13 R14 regenerating a map replaces all three copies and clears its undo', () => {
    let state = placeMap(empty, 'albedo', image('a1'));
    state = editMaps(state, [{ kind: 'albedo', workingKey: 'a2' }], 'Filter');
    state = placeMap(state, 'albedo', image('a5'));
    expect(state.maps.albedo).toEqual({ originalKey: 'a5', workingKey: 'a5', undoKey: null, width: 1024, height: 1024 });
    expect(referencedMapKeys(state)).toEqual(new Set(['a5']));
  });

  it('R22 a computed map is placed with derivedFrom', () => {
    const state = placeMap(placeMap(empty, 'normal', image('n1')), 'ao', { ...image('ao1'), derivedFrom: { kind: 'normal', key: 'n1' } });
    expect(state.maps.ao?.derivedFrom).toEqual({ kind: 'normal', key: 'n1' });
  });

  it('R18 placing into an empty slot leaves another map\'s own undo entry alone', () => {
    let state = placeMap(placeMap(empty, 'albedo', image('a1')), 'normal', image('n1'));
    state = editMaps(state, [{ kind: 'normal', workingKey: 'n2' }], 'Denoise');
    state = placeMap(state, 'height', image('h1'));
    expect(state.maps.normal?.undoKey).toBe('n1');
    expect(undoMaps(state, ['normal']).maps.normal?.workingKey).toBe('n1');
  });
});

describe('materialgen/maps R16 R18 editMaps and undoMaps', () => {
  const two = placeMap(placeMap(empty, 'albedo', image('a1')), 'normal', image('n1'));

  it('R16 an edit keeps the original, sets the new working key and records the previous one as the map\'s own undo', () => {
    const next = editMaps(two, [{ kind: 'albedo', workingKey: 'a2' }], 'Filter');
    expect(next.maps.albedo).toMatchObject({ originalKey: 'a1', workingKey: 'a2', undoKey: 'a1', undo: { label: 'Filter' } });
    expect(next.maps.normal).toEqual(two.maps.normal);
  });

  it('R16 a second edit replaces the entry as a whole and keeps the original', () => {
    const once = editMaps(two, [{ kind: 'albedo', workingKey: 'a2' }], 'Filter');
    const twice = editMaps(once, [{ kind: 'albedo', workingKey: 'a3' }], 'Blur');
    expect(twice.maps.albedo).toMatchObject({ originalKey: 'a1', workingKey: 'a3', undoKey: 'a2', undo: { label: 'Blur' } });
  });

  it('R18 undo of one map leaves the entry of another map in place', () => {
    let state = editMaps(two, [{ kind: 'albedo', workingKey: 'a2' }], 'Filter');
    state = editMaps(state, [{ kind: 'normal', workingKey: 'n2' }], 'Denoise');
    state = undoMaps(state, ['normal']);
    expect(state.maps.normal).toMatchObject({ workingKey: 'n1', undoKey: null });
    expect(state.maps.albedo).toMatchObject({ workingKey: 'a2', undoKey: 'a1' });
    expect(state.maps.normal?.undo).toBeUndefined();
  });

  it('R18 undo is not itself undoable and a map without an entry is left as it is', () => {
    const state = undoMaps(two, ['albedo']);
    expect(state).toEqual(two);
    expect(canUndo(two, 'albedo')).toBe(false);
    expect(canUndo(editMaps(two, [{ kind: 'albedo', workingKey: 'a2' }], 'F'), 'albedo')).toBe(true);
  });

  it('R18 when the undo key equals the original the working key becomes the original key', () => {
    const state = undoMaps(editMaps(two, [{ kind: 'albedo', workingKey: 'a2' }], 'F'), ['albedo']);
    expect(state.maps.albedo?.workingKey).toBe('a1');
    expect(referencedMapKeys(state)).toEqual(new Set(['a1', 'n1']));
  });

  it('R47 the Metal-Roughness card undoes both of its maps together', () => {
    let state = placeMap(placeMap(empty, 'rough', image('r1')), 'metal', image('m1'));
    state = editMaps(state, [{ kind: 'rough', workingKey: 'r2' }, { kind: 'metal', workingKey: 'm2' }], 'Mask commit');
    state = undoMaps(state, ['rough', 'metal']);
    expect([state.maps.rough?.workingKey, state.maps.metal?.workingKey]).toEqual(['r1', 'm1']);
  });

  it('R16 an edit restores the previous derivedFrom on undo', () => {
    let state = placeMap(placeMap(empty, 'normal', image('n1')), 'ao', { ...image('ao1'), derivedFrom: { kind: 'normal', key: 'n1' } });
    state = editMaps(state, [{ kind: 'ao', workingKey: 'ao2', derivedFrom: { kind: 'normal', key: 'n3' } }], 'Regenerate AO');
    expect(state.maps.ao?.derivedFrom).toEqual({ kind: 'normal', key: 'n3' });
    expect(undoMaps(state, ['ao']).maps.ao?.derivedFrom).toEqual({ kind: 'normal', key: 'n1' });
  });

  it('R33 an edit with derivedFrom null removes it, so a dropped image shows no stale badge', () => {
    let state = placeMap(placeMap(empty, 'normal', image('n1')), 'ao', { ...image('ao1'), derivedFrom: { kind: 'normal', key: 'n1' } });
    state = editMaps(state, [{ kind: 'ao', workingKey: 'ao2', derivedFrom: null }], 'Drop');
    expect(state.maps.ao?.derivedFrom).toBeUndefined();
    expect(isStale(state, 'ao')).toBe(false);
  });
});

describe('materialgen/maps R19 restoreOriginal', () => {
  it('R19 the working map becomes the original when it is already S x S, as an undoable edit', () => {
    let state = editMaps(placeMap(empty, 'albedo', image('a1')), [{ kind: 'albedo', workingKey: 'a2' }], 'Filter');
    state = restoreOriginal(state, 'albedo');
    expect(state.maps.albedo).toMatchObject({ originalKey: 'a1', workingKey: 'a1', undoKey: 'a2', undo: { label: 'Restore original' } });
  });

  it('R19 a resampled original is supplied as a new working key', () => {
    const state = restoreOriginal(placeMap(empty, 'albedo', { originalKey: 'o', workingKey: 'w', width: 1920, height: 1080 }), 'albedo', 'w2');
    expect(state.maps.albedo).toMatchObject({ workingKey: 'w2', undoKey: 'w' });
  });

  it('R19 it does nothing when the working key already equals the original', () => {
    const start = placeMap(empty, 'albedo', image('a1'));
    expect(restoreOriginal(start, 'albedo')).toEqual(start);
  });
});

describe('materialgen/maps R20 clearMap', () => {
  it('R20 removes the map with its three keys and leaves the other maps and S alone', () => {
    let state = placeMap(placeMap(empty, 'albedo', image('a1')), 'normal', image('n1'));
    state = clearMap(state, 'albedo');
    expect(state.maps.albedo).toBeUndefined();
    expect(state.size).toBe(1024);
    expect(referencedMapKeys(state)).toEqual(new Set(['n1']));
  });

  it('R20 R15 clearing the last map unsets S', () => {
    expect(clearMap(placeMap(empty, 'albedo', image('a1')), 'albedo')).toEqual(empty);
  });

  it('R20 a derived map is stale after its source is cleared', () => {
    let state = placeMap(placeMap(empty, 'normal', image('n1')), 'ao', { ...image('ao1'), derivedFrom: { kind: 'normal', key: 'n1' } });
    state = clearMap(state, 'normal');
    expect(isStale(state, 'ao')).toBe(true);
  });

  it('R14 R70 clearing a live group member drops the entries of the other members', () => {
    let state = placeMap(placeMap(empty, 'albedo', image('a1')), 'normal', image('n1'));
    state = editMaps(state, [{ kind: 'albedo', workingKey: 'a2' }, { kind: 'normal', workingKey: 'n2' }], 'Mirror', { groupId: 'g1' });
    state = clearMap(state, 'albedo');
    expect(state.maps.normal).toMatchObject({ workingKey: 'n2', undoKey: null });
    expect(state.maps.normal?.undo).toBeUndefined();
    expect(referencedMapKeys(state)).toEqual(new Set(['n1', 'n2']));
  });
});

describe('materialgen/maps R21 R70 changeSize and groups', () => {
  const start = (): MapsState => {
    let state = placeMap(empty, 'albedo', image('a1'));
    state = placeMap(state, 'normal', image('n1'));
    return placeMap(state, 'ao', { ...image('ao1'), derivedFrom: { kind: 'normal', key: 'n1' } });
  };

  it('R21 every working map gets a new key, originals stay, one group records the previous S, fresh derivedFrom is remapped', () => {
    const next = changeSize(start(), 512, { albedo: 'a4', normal: 'n4', ao: 'ao3' }, 'g1');
    expect(next.size).toBe(512);
    expect(next.maps.albedo).toMatchObject({ originalKey: 'a1', workingKey: 'a4', undoKey: 'a1', undo: { groupId: 'g1', size: 1024 } });
    expect(next.maps.ao?.derivedFrom).toEqual({ kind: 'normal', key: 'n4' });
    expect(isStale(next, 'ao')).toBe(false);
  });

  it('normal-from-height R9 a normal map made from the height goes stale when the height changes, and a dropped or painted one never does', () => {
    let state = placeMap(placeMap(empty, 'height', image('h1')), 'normal', { ...image('n1'), derivedFrom: { kind: 'height', key: 'h1' } });
    expect(isStale(state, 'normal')).toBe(false);
    state = editMaps(state, [{ kind: 'height', workingKey: 'h2' }], 'Blur');
    expect(isStale(state, 'normal')).toBe(true);
    const dropped = editMaps(state, [{ kind: 'normal', workingKey: 'n2', derivedFrom: null }], 'Drop');
    expect(isStale(dropped, 'normal')).toBe(false);
    const painted = placeMap(placeMap(empty, 'height', image('h1')), 'normal', image('n9'));
    expect(isStale(editMaps(painted, [{ kind: 'height', workingKey: 'h2' }], 'Blur'), 'normal')).toBe(false);
  });

  it('normal-from-height R9 a derived normal follows the height through an S change while fresh, and undo returns its derivedFrom', () => {
    let state = placeMap(placeMap(empty, 'height', image('h1')), 'normal', { ...image('n1'), derivedFrom: { kind: 'height', key: 'h1' } });
    state = changeSize(state, 512, { height: 'h4', normal: 'n4' }, 'g1');
    expect(state.maps.normal?.derivedFrom).toEqual({ kind: 'height', key: 'h4' });
    expect(isStale(state, 'normal')).toBe(false);
    state = editMaps(state, [{ kind: 'normal', workingKey: 'n5', derivedFrom: { kind: 'height', key: 'h4' } }], 'Regenerate normal map');
    expect(undoMaps(state, ['normal']).maps.normal?.derivedFrom).toEqual({ kind: 'height', key: 'h4' });
  });

  it('normal-from-height R9 a normal map is stale once its height is cleared', () => {
    const state = clearMap(placeMap(placeMap(empty, 'height', image('h1')), 'normal', { ...image('n1'), derivedFrom: { kind: 'height', key: 'h1' } }), 'height');
    expect(isStale(state, 'normal')).toBe(true);
  });

  it('R21 a stale derived map stays stale', () => {
    let state = editMaps(start(), [{ kind: 'normal', workingKey: 'n2' }], 'Denoise');
    expect(isStale(state, 'ao')).toBe(true);
    state = changeSize(state, 512, { albedo: 'a4', normal: 'n4', ao: 'ao3' }, 'g1');
    expect(isStale(state, 'ao')).toBe(true);
  });

  it('R21 the same size does nothing', () => {
    expect(changeSize(start(), 1024, {}, 'g1')).toEqual(start());
  });

  it('R21 setting S with no map writes nothing and creates no group', () => {
    expect(changeSize(empty, 512, {}, 'g1')).toEqual({ size: 512, maps: {} });
  });

  it('R18 R70 undo on any member returns every map and S', () => {
    const changed = changeSize(start(), 512, { albedo: 'a4', normal: 'n4', ao: 'ao3' }, 'g1');
    expect(undoTargets(changed, ['normal']).sort()).toEqual(['albedo', 'ao', 'normal']);
    const undone = undoMaps(changed, ['normal']);
    expect(undone.size).toBe(1024);
    expect(undone.maps).toEqual(start().maps);
  });

  it('R18 R70 placing into an empty slot after an S change breaks the group and disables Undo everywhere', () => {
    const changed = changeSize(start(), 512, { albedo: 'a4', normal: 'n4', ao: 'ao3' }, 'g1');
    const placed = placeMap(changed, 'height', image('h1', 512));
    for (const kind of ['albedo', 'normal', 'ao'] as const) expect(canUndo(placed, kind)).toBe(false);
    expect(placed.size).toBe(512);
    expect(referencedMapKeys(placed)).toEqual(new Set(['a1', 'a4', 'n1', 'n4', 'ao1', 'ao3', 'h1']));
  });

  it('R70 editing one member after a crop breaks the group and drops the other entries', () => {
    let state = editMaps(start(), [{ kind: 'albedo', workingKey: 'a6' }, { kind: 'normal', workingKey: 'n5' }, { kind: 'ao', workingKey: 'ao4' }], 'Crop', { groupId: 'g2' });
    state = editMaps(state, [{ kind: 'albedo', workingKey: 'a7' }], 'Filter');
    expect(state.maps.albedo).toMatchObject({ workingKey: 'a7', undoKey: 'a6' });
    expect(state.maps.normal).toMatchObject({ workingKey: 'n5', undoKey: null });
    expect(state.maps.ao).toMatchObject({ workingKey: 'ao4', undoKey: null });
    expect(checkMapsInvariants(state)).toEqual([]);
  });

  it('R70 a new geometry group replaces the older one and leaves no half group', () => {
    let state = editMaps(start(), [{ kind: 'albedo', workingKey: 'a2' }, { kind: 'normal', workingKey: 'n2' }], 'Mirror', { groupId: 'g1' });
    state = editMaps(state, [{ kind: 'albedo', workingKey: 'a3' }, { kind: 'normal', workingKey: 'n3' }, { kind: 'ao', workingKey: 'ao3' }], 'Crop', { groupId: 'g2' });
    expect(Object.values(state.maps).map((map) => map?.undo?.groupId)).toEqual(['g2', 'g2', 'g2']);
  });
});

describe('materialgen/maps R32 R33 isStale', () => {
  it('R32 AO from the normal map is stale after the normal edit and fresh again after that edit is undone', () => {
    let state = placeMap(placeMap(empty, 'normal', image('n1')), 'ao', { ...image('ao1'), derivedFrom: { kind: 'normal', key: 'n1' } });
    state = editMaps(state, [{ kind: 'normal', workingKey: 'n2' }], 'Denoise');
    expect(isStale(state, 'ao')).toBe(true);
    expect(isStale(undoMaps(state, ['normal']), 'ao')).toBe(false);
  });

  it('R32 a height map placed later does not make AO from the normal map stale', () => {
    const state = placeMap(placeMap(placeMap(empty, 'normal', image('n1')), 'ao', { ...image('ao1'), derivedFrom: { kind: 'normal', key: 'n1' } }), 'height', image('h1'));
    expect(isStale(state, 'ao')).toBe(false);
  });

  it('R32 a map placed by drop has no derivedFrom and is never stale', () => {
    expect(isStale(placeMap(empty, 'ao', image('ao1')), 'ao')).toBe(false);
  });
});

describe('materialgen/maps worked example (R8 R11 R70)', () => {
  it('walks the 17 steps and gives the blob totals of the spec table', () => {
    const totals: number[] = [];
    const record = (state: MapsState): MapsState => (totals.push(total(state)), state);
    let s = record(placeMap(empty, 'albedo', image('a1'))); // 1
    s = record(placeMap(s, 'normal', image('n1'))); // 2
    s = record(editMaps(s, [{ kind: 'albedo', workingKey: 'a2' }], 'Filter')); // 3
    s = record(editMaps(s, [{ kind: 'albedo', workingKey: 'a3' }], 'Filter')); // 4
    s = record(editMaps(s, [{ kind: 'normal', workingKey: 'n2' }], 'Denoise')); // 5
    s = record(undoMaps(s, ['normal'])); // 6
    s = record(placeMap(s, 'ao', { ...image('ao1'), derivedFrom: { kind: 'normal', key: 'n1' } })); // 7
    s = record(editMaps(s, [{ kind: 'normal', workingKey: 'n3' }], 'Denoise')); // 8
    expect(isStale(s, 'ao')).toBe(true);
    s = record(editMaps(s, [{ kind: 'ao', workingKey: 'ao2', derivedFrom: { kind: 'normal', key: 'n3' } }], 'Regenerate AO')); // 9
    expect(isStale(s, 'ao')).toBe(false);
    s = record(placeMap(s, 'height', { originalKey: 'h1', workingKey: 'h2', width: 512, height: 512 })); // 10
    s = record(restoreOriginal(s, 'albedo')); // 11
    s = record(changeSize(s, 512, { albedo: 'a4', normal: 'n4', ao: 'ao3', height: 'h3' }, 'g1')); // 12
    expect(s.maps.ao?.derivedFrom).toEqual({ kind: 'normal', key: 'n4' });
    s = record(undoMaps(s, ['albedo'])); // 13
    expect(s.size).toBe(1024);
    s = record(clearMap(s, 'height')); // 14
    s = record(placeMap(s, 'albedo', image('a5'))); // 15
    s = record(editMaps(s, [{ kind: 'albedo', workingKey: 'a6' }, { kind: 'normal', workingKey: 'n5' }, { kind: 'ao', workingKey: 'ao4', derivedFrom: { kind: 'normal', key: 'n5' } }], 'Crop', { groupId: 'g2' })); // 16
    s = record(editMaps(s, [{ kind: 'albedo', workingKey: 'a7' }], 'Filter')); // 17
    expect(totals).toEqual([1, 2, 3, 4, 5, 4, 5, 6, 7, 9, 8, 11, 7, 5, 5, 8, 7]);
    expect(checkMapsInvariants(s)).toEqual([]);
  });
});

describe('materialgen/maps R24 R25 R26 checkMapsInvariants', () => {
  it('R24 reports a size outside the allowed set while maps exist', () => {
    const state = { ...placeMap(empty, 'albedo', image('a1')), size: 300 as never };
    expect(checkMapsInvariants(state)).toContain('size 300 is not an allowed size');
  });

  it('R26 reports an undo key without its entry and an entry without its key', () => {
    const state = placeMap(empty, 'albedo', image('a1'));
    const bad: MapsState = { ...state, maps: { albedo: { ...state.maps.albedo!, undoKey: 'x' } } };
    expect(checkMapsInvariants(bad)).toContain('albedo: undoKey is set without an undo entry');
    const other: MapsState = { ...state, maps: { albedo: { ...state.maps.albedo!, undo: { label: 'x' } } } };
    expect(checkMapsInvariants(other)).toContain('albedo: an undo entry exists without an undoKey');
  });

  it('R6 reports a labels map that has an undo entry', () => {
    const state = placeMap(empty, 'labels', image('l1'));
    const bad: MapsState = { ...state, maps: { labels: { ...state.maps.labels!, undoKey: 'l0', undo: { label: 'x' } } } };
    expect(checkMapsInvariants(bad)).toContain('labels: never has an undo entry');
  });

  it('R70 reports a group id whose entries disagree about the previous size', () => {
    const state = placeMap(placeMap(empty, 'albedo', image('a1')), 'normal', image('n1'));
    const bad: MapsState = {
      ...state,
      maps: {
        albedo: { ...state.maps.albedo!, undoKey: 'a0', undo: { label: 'x', groupId: 'g', size: 512 } },
        normal: { ...state.maps.normal!, undoKey: 'n0', undo: { label: 'x', groupId: 'g', size: 256 } },
      },
    };
    expect(checkMapsInvariants(bad)).toContain('group g: members disagree about the previous size');
  });
});
