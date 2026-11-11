import { BoxGeometry, Group, Mesh, MeshStandardMaterial, Scene } from 'three';
import { GLTFExporter } from 'three/examples/jsm/exporters/GLTFExporter.js';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { beforeAll, describe, expect, it } from 'vitest';
import { flagsFromRanges, MESH_EDIT_KEY, readHiddenMarks, writeHiddenMarks } from '../../src/hiddenMarks';
import { installNodeFileReader } from '../support/installNodeFileReader';

beforeAll(installNodeFileReader);

const flags = (...bits: number[]): Uint8Array => Uint8Array.from(bits);

describe('R12 hidden marks codec', () => {
  it('R12 writes sorted merged ranges per mesh ordinal and nothing when no triangle is hidden', () => {
    const marks = writeHiddenMarks([
      { meshOrdinal: 0, hidden: flags(0, 1, 1, 0, 1) },
      { meshOrdinal: 2, hidden: flags(0, 0, 0) },
      { meshOrdinal: 3, hidden: flags(1, 1, 1) },
    ]);
    expect(marks).toEqual({ v: 1, hidden: { '0': [[1, 2], [4, 1]], '3': [[0, 3]] } });
    expect(writeHiddenMarks([{ meshOrdinal: 0, hidden: flags(0, 0) }])).toBeUndefined();
  });

  it('R12 reads the marks back and merges overlapping or touching ranges', () => {
    const read = readHiddenMarks({ [MESH_EDIT_KEY]: { v: 1, hidden: { '1': [[4, 2], [0, 3], [3, 1]], '5': [[2, 2]] } } });
    expect([...read.entries()]).toEqual([[1, [[0, 6]]], [5, [[2, 2]]]]);
  });

  it('R12 reads bad or unknown input as nothing hidden', () => {
    for (const bad of [undefined, null, 7, {}, { [MESH_EDIT_KEY]: 'x' }, { [MESH_EDIT_KEY]: { v: 2, hidden: { '0': [[0, 1]] } } }, { [MESH_EDIT_KEY]: { v: 1, hidden: [] } }]) {
      expect(readHiddenMarks(bad).size).toBe(0);
    }
    const partly = readHiddenMarks({ [MESH_EDIT_KEY]: { v: 1, hidden: { '0': [[-1, 2], [1.5, 1], ['a', 1], [2, 0], [3, 2]], x: [[0, 1]] } } });
    expect([...partly.entries()]).toEqual([[0, [[3, 2]]]]);
  });

  it('R12 turns ranges into per-triangle flags and ignores ranges past the end', () => {
    expect([...flagsFromRanges([[1, 2], [5, 4]], 6)]).toEqual([0, 1, 1, 0, 0, 1]);
    expect([...flagsFromRanges(undefined, 3)]).toEqual([0, 0, 0]);
  });

  it('R12 the marks survive GLTFExporter (given a Scene) and GLTFLoader', async () => {
    const scene = new Scene();
    const marks = writeHiddenMarks([{ meshOrdinal: 0, hidden: flags(0, 1, 1, 0) }]);
    scene.userData[MESH_EDIT_KEY] = marks;
    scene.add(new Mesh(new BoxGeometry(), new MeshStandardMaterial()));
    const exported = (await new GLTFExporter().parseAsync(scene, { binary: true })) as ArrayBuffer;
    const loaded = await new GLTFLoader().parseAsync(exported, '');
    expect([...readHiddenMarks(loaded.scene.userData).entries()]).toEqual([[0, [[1, 2]]]]);
  });

  it('R12 a plain Group would not carry them on the scene (why Apply exports a Scene)', async () => {
    const group = new Group();
    group.userData[MESH_EDIT_KEY] = writeHiddenMarks([{ meshOrdinal: 0, hidden: flags(1) }]);
    group.add(new Mesh(new BoxGeometry(), new MeshStandardMaterial()));
    const exported = (await new GLTFExporter().parseAsync(group, { binary: true })) as ArrayBuffer;
    const loaded = await new GLTFLoader().parseAsync(exported, '');
    expect(readHiddenMarks(loaded.scene.userData).size).toBe(0);
  });
});
