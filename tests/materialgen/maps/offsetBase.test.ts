import { describe, expect, it } from 'vitest';
import { changeSize, clearMap, editMaps, placeMap, referencedMapKeys, restoreOriginal, undoMaps } from '../../../src/materialgen/maps/mapOperations';
import { heightBaseKey } from '../../../src/materialgen/maps/heightBase';
import type { MapsState } from '../../../src/materialgen/maps';

const empty: MapsState = { size: null, maps: {} };
const placed = (): MapsState => placeMap(placeMap(empty, 'albedo', { originalKey: 'a1', workingKey: 'a1', width: 1024, height: 1024 }), 'height', { originalKey: 'h1', workingKey: 'h1', width: 1024, height: 1024 });
const withSize = (state: MapsState): MapsState => ({ ...state, size: 1024 });

describe('materialgen/maps offsetBase tag (masks R83, maps R16)', () => {
  it('R83 a height-offset edit tags the new working map with the base it was computed from', () => {
    const next = editMaps(withSize(placed()), [{ kind: 'height', workingKey: 'h2', offsetBase: 'h1' }], 'Material masks');
    expect(next.maps.height).toMatchObject({ workingKey: 'h2', undoKey: 'h1', offsetBase: 'h1' });
    expect(next.maps.height?.undo?.offsetBase).toBeUndefined(); // the map before had no tag
  });

  it('R83 any other edit of the map (a filter, a restore) removes the tag: it is no longer one of ours', () => {
    const baked = editMaps(withSize(placed()), [{ kind: 'height', workingKey: 'h2', offsetBase: 'h1' }], 'Material masks');
    const filtered = editMaps(baked, [{ kind: 'height', workingKey: 'h3' }], 'Blur');
    expect(filtered.maps.height?.offsetBase).toBeUndefined();
    expect(filtered.maps.height?.undo?.offsetBase).toBe('h1');
  });

  it('R83 Undo returns the tag together with the working key, so an offset is never applied twice', () => {
    let state = editMaps(withSize(placed()), [{ kind: 'height', workingKey: 'h2', offsetBase: 'h1' }], 'Material masks');
    state = editMaps(state, [{ kind: 'height', workingKey: 'h3', offsetBase: 'h1' }], 'Material masks');
    expect(state.maps.height).toMatchObject({ workingKey: 'h3', undoKey: 'h2', offsetBase: 'h1' });
    const undone = undoMaps(state, ['height']);
    expect(undone.maps.height).toMatchObject({ workingKey: 'h2', offsetBase: 'h1' });
    expect(heightBaseKey(undone)).toBe('h1');
    const undoneTwice = undoMaps(editMaps(undone, [{ kind: 'height', workingKey: 'h4' }], 'Blur'), ['height']);
    expect(undoneTwice.maps.height?.offsetBase).toBe('h1');
  });

  it('R83 the base blob counts as referenced while a working or undo entry of Height tags it', () => {
    const baked = editMaps(withSize(placed()), [{ kind: 'height', workingKey: 'h2', offsetBase: 'hb' }], 'Material masks');
    expect(referencedMapKeys(baked).has('hb')).toBe(true);
    const filtered = editMaps(baked, [{ kind: 'height', workingKey: 'h3' }], 'Blur'); // the tag is only in the undo entry now
    expect(referencedMapKeys(filtered).has('hb')).toBe(true);
    const gone = editMaps(filtered, [{ kind: 'height', workingKey: 'h4' }], 'Blur'); // the entry was replaced
    expect(referencedMapKeys(gone).has('hb')).toBe(false);
  });

  it('R83 the base is the working map\'s tag when it has one, else the working map itself', () => {
    expect(heightBaseKey(placed())).toBe('h1');
    const baked = editMaps(withSize(placed()), [{ kind: 'height', workingKey: 'h2', offsetBase: 'h1' }], 'Material masks');
    expect(heightBaseKey(baked)).toBe('h1');
    expect(heightBaseKey({ size: null, maps: {} })).toBeUndefined();
  });

  it('R88 Restore original shows the map as it is: no tag, so the next height commit takes it as the base', () => {
    const baked = editMaps(withSize(placed()), [{ kind: 'height', workingKey: 'h2', offsetBase: 'h1' }], 'Material masks');
    const restored = restoreOriginal(baked, 'height');
    expect(restored.maps.height?.workingKey).toBe('h1');
    expect(restored.maps.height?.offsetBase).toBeUndefined();
    expect(heightBaseKey(restored)).toBe('h1');
  });

  it('R88 Clearing the Height slot drops the tag with the map', () => {
    const baked = editMaps(withSize(placed()), [{ kind: 'height', workingKey: 'h2', offsetBase: 'h1' }], 'Material masks');
    expect(clearMap(baked, 'height').maps.height).toBeUndefined();
  });

  it('R87 a change of S points the tag at the resampled base; the S group\'s entry keeps the previous tag', () => {
    const baked = editMaps(withSize(placed()), [{ kind: 'height', workingKey: 'h2', offsetBase: 'h1' }], 'Material masks');
    const resized = changeSize(baked, 512, { albedo: 'a2', height: 'h5' }, 'g1', 'hb5');
    expect(resized.maps.height).toMatchObject({ workingKey: 'h5', offsetBase: 'hb5', undo: { groupId: 'g1', offsetBase: 'h1' } });
    const undone = undoMaps(resized, ['height']);
    expect(undone.size).toBe(1024);
    expect(undone.maps.height).toMatchObject({ workingKey: 'h2', offsetBase: 'h1' });
  });

  it('R87 a change of S leaves an untagged Height untagged', () => {
    const resized = changeSize(withSize(placed()), 512, { albedo: 'a2', height: 'h5' }, 'g1');
    expect(resized.maps.height?.offsetBase).toBeUndefined();
  });
});
