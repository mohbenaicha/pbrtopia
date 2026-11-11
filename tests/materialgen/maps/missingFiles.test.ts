import { describe, expect, it } from 'vitest';
import { changeSize, editMaps, placeMap, type MapsState } from '../../../src/materialgen/maps';
import { reportMissingFiles } from '../../../src/materialgen/maps/missingFiles';

const base = (): MapsState => {
  let state: MapsState = { size: 256, maps: {} };
  state = placeMap(state, 'albedo', { originalKey: 'a0', workingKey: 'a0', width: 256, height: 256 });
  state = placeMap(state, 'normal', { originalKey: 'n0', workingKey: 'n0', width: 256, height: 256 });
  return state;
};

describe('materialgen/maps R30 reporting files the record names but the store does not have', () => {
  it('R30 nothing missing changes nothing and reports nothing', () => {
    const state = base();
    expect(reportMissingFiles(state, [], 'albedo')).toEqual({ state, lines: [], released: [] });
  });

  it('R30 each map with a missing file is named once as "<name>: file missing", in the card name of the colour mode', () => {
    const state = editMaps(base(), [{ kind: 'albedo', workingKey: 'a1' }], 'Filter');
    expect(reportMissingFiles(state, ['a1', 'a0'], 'diffuse').lines).toEqual(['Diffuse: file missing']);
    expect(reportMissingFiles(state, ['n0', 'a1'], 'albedo').lines).toEqual(['Albedo: file missing', 'Normal: file missing']);
  });

  it('R30 a missing working or original file leaves the record as it is (the slot shows "Missing file", Restore original stays)', () => {
    const state = editMaps(base(), [{ kind: 'albedo', workingKey: 'a1' }], 'Filter');
    expect(reportMissingFiles(state, ['a1'], 'albedo').state).toBe(state);
  });

  it("R30 a missing undo file drops that map's undo entry; its own working and original stay", () => {
    const state = editMaps(base(), [{ kind: 'albedo', workingKey: 'a1' }], 'Filter');
    const after = reportMissingFiles(state, [state.maps.albedo!.undoKey!], 'albedo').state;
    expect(after.maps.albedo).toMatchObject({ originalKey: 'a0', workingKey: 'a1', undoKey: null });
    expect(after.maps.albedo!.undo).toBeUndefined();
    expect(after.maps.normal).toBe(state.maps.normal);
  });

  it('R30 R70 a missing undo file of one member of a group drops the entries of every live member', () => {
    const state = changeSize(base(), 512, { albedo: 'a1', normal: 'n1' }, 'g1');
    const after = reportMissingFiles(state, [state.maps.albedo!.undoKey!], 'albedo').state;
    expect(after.maps.albedo!.undoKey).toBeNull();
    expect(after.maps.normal!.undoKey).toBeNull();
    expect(after.maps.normal!.workingKey).toBe('n1');
    expect(after.size).toBe(512);
  });

  it('R30 R29 the readable undo files of the dropped entries are released at once (named for deletion); nothing is released when no entry is dropped', () => {
    const edited = editMaps(base(), [{ kind: 'albedo', workingKey: 'a1' }, { kind: 'normal', workingKey: 'n1' }], 'Filter');
    const state = changeSize(edited, 512, { albedo: 'a2', normal: 'n2' }, 'g1'); // undo keys: a1, n1
    const report = reportMissingFiles(state, ['a1'], 'albedo');
    expect(report.released).toEqual(['n1']); // a1 is the missing one (nothing to delete); n1 was normal's undo and is no longer referenced
    expect(reportMissingFiles(state, ['a2'], 'albedo').released).toEqual([]);
  });
});
