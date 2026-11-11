import { describe, expect, it } from 'vitest';
import { findEditedSlot } from '../../../src/materialgen/maps/lastEditedSlot';
import { changeSize, editMaps, placeMap, restoreOriginal, undoMaps } from '../../../src/materialgen/maps/mapOperations';
import type { MapsState } from '../../../src/materialgen/maps';

const two = (): MapsState => placeMap(placeMap({ size: 256, maps: {} }, 'albedo', { originalKey: 'a', workingKey: 'a', width: 256, height: 256 }), 'rough', { originalKey: 'r', workingKey: 'r', width: 256, height: 256 });

describe('materialgen/app R47 findEditedSlot', () => {
  it('R47 a map that gains an undo entry names its slot', () => {
    const before = two();
    const after = editMaps(before, [{ kind: 'rough', workingKey: 'r2' }], 'Filter');
    expect(findEditedSlot(before, after)).toBe('metalRoughness');
  });

  it('R47 nothing changed, or a map placed with no undo entry, names no slot', () => {
    const before = two();
    expect(findEditedSlot(before, before)).toBeNull();
    expect(findEditedSlot(before, placeMap(before, 'height', { originalKey: 'h', workingKey: 'h', width: 256, height: 256 }))).toBeNull();
  });

  it('R47 an undo removes the entry and so names no slot (the last edited card stays as it was)', () => {
    const edited = editMaps(two(), [{ kind: 'albedo', workingKey: 'a2' }], 'Filter');
    expect(findEditedSlot(edited, undoMaps(edited, ['albedo']))).toBeNull();
  });

  it('R47 a grouped edit across maps names the first changed slot in card order, deterministically', () => {
    const before = two();
    const after = editMaps(before, [{ kind: 'rough', workingKey: 'r2' }, { kind: 'albedo', workingKey: 'a2' }], 'Mirror', { groupId: 'g1' });
    expect(findEditedSlot(before, after)).toBe('color');
  });

  it('R47 a size change and a restore of the original count as edits', async () => {
    const before = two();
    const resized = changeSize(before, 512, { albedo: 'a5', rough: 'r5' }, 'g2');
    expect(findEditedSlot(before, resized)).toBe('color');
    const edited = editMaps(before, [{ kind: 'rough', workingKey: 'r2' }], 'Filter');
    const restored = restoreOriginal(edited, 'rough', 'r');
    expect(findEditedSlot(edited, restored)).toBe('metalRoughness');
  });

  it('R47 a second edit of the same map is a new edit', () => {
    const first = editMaps(two(), [{ kind: 'albedo', workingKey: 'a2' }], 'Filter');
    const second = editMaps(first, [{ kind: 'albedo', workingKey: 'a3' }], 'Filter');
    expect(findEditedSlot(first, second)).toBe('color');
  });
});
