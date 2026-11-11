import { BoxGeometry, Mesh, MeshStandardMaterial, Scene } from 'three';
import { GLTFExporter } from 'three/examples/jsm/exporters/GLTFExporter.js';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { beforeAll, describe, expect, it } from 'vitest';
import { MESH_EDIT_KEY, readHiddenMarks } from '../../src/hiddenMarks';
import { exportModelWithPictures } from '../../src/viewport/exportModelWithPictures';
import { loadModelAsset } from '../../src/viewport/loadModelAsset';
import { installNodeFileReader } from '../support/installNodeFileReader';

beforeAll(installNodeFileReader);

// Mesh 0: a unit box at the origin. Mesh 1: a unit box at x = 100. Marks hide the +X face of mesh 0 and all of mesh 1.
async function twoBoxGlb(marks: unknown): Promise<ArrayBuffer> {
  const scene = new Scene();
  scene.userData[MESH_EDIT_KEY] = marks;
  const far = new Mesh(new BoxGeometry(1, 1, 1), new MeshStandardMaterial());
  far.position.x = 100;
  scene.add(new Mesh(new BoxGeometry(1, 1, 1), new MeshStandardMaterial()), far);
  return (await new GLTFExporter().parseAsync(scene, { binary: true })) as ArrayBuffer;
}

const MARKS = { v: 1, hidden: { '0': [[0, 2]], '1': [[0, 12]] } };
const triangles = (geometry: { index: { count: number } | null }): number => (geometry.index?.count ?? 0) / 3;

describe('R30 R13 the viewport loader and hidden triangles', () => {
  it('R30 draws only the visible triangles and keeps the full geometry and the flags on the asset', async () => {
    const loaded = await loadModelAsset(await twoBoxGlb(MARKS));
    if (!loaded.ok) throw new Error('load failed');
    const [first, second] = loaded.value.meshes;
    expect(triangles(first!.mesh.geometry)).toBe(10);
    expect(triangles(first!.full)).toBe(12);
    expect([...first!.hidden!.slice(0, 3)]).toEqual([1, 1, 0]);
    expect(triangles(second!.mesh.geometry)).toBe(0);
    expect(first!.ordinal).toBe(0);
    expect(second!.ordinal).toBe(1);
  });

  it('R13 the bounds and the camera framing come from the visible part', async () => {
    const loaded = await loadModelAsset(await twoBoxGlb(MARKS));
    if (!loaded.ok) throw new Error('load failed');
    expect(loaded.value.bounds.radius).toBeLessThan(2);
  });

  it('R28 includeHidden draws every triangle and drops the marks from the scene', async () => {
    const loaded = await loadModelAsset(await twoBoxGlb(MARKS), { includeHidden: true });
    if (!loaded.ok) throw new Error('load failed');
    expect(loaded.value.meshes.every((record) => record.hidden === undefined)).toBe(true);
    expect(triangles(loaded.value.meshes[0]!.mesh.geometry)).toBe(12);
    expect(loaded.value.root.userData[MESH_EDIT_KEY]).toBeUndefined();
  });

  it('R30 a model with every part hidden is refused with a reason', async () => {
    const loaded = await loadModelAsset(await twoBoxGlb({ v: 1, hidden: { '0': [[0, 12]], '1': [[0, 12]] } }));
    expect(loaded).toMatchObject({ ok: false });
    if (!loaded.ok) expect(loaded.error.message).toMatch(/hidden/i);
  });

  it('R28 the download writes every triangle and carries no hidden marks', async () => {
    const result = await exportModelWithPictures(await twoBoxGlb(MARKS), []);
    if (!result.ok) throw new Error(result.error.message);
    const reloaded = await new GLTFLoader().parseAsync(await result.value.arrayBuffer(), '');
    expect(readHiddenMarks(reloaded.scene.userData).size).toBe(0);
    let count = 0;
    reloaded.scene.traverse((object) => {
      const mesh = object as Mesh;
      if (mesh.isMesh) count += triangles(mesh.geometry);
    });
    expect(count).toBe(24);
  });
});
