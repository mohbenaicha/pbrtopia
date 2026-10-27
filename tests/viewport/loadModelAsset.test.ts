import { Texture, type Mesh, type MeshStandardMaterial } from 'three';
import { describe, expect, it, vi } from 'vitest';
import { loadModelAsset } from '../../src/viewport/loadModelAsset';
import { buildGlbFromJsonText, buildTriangleGlb } from './glbBuilder';

describe('loadModelAsset (projects R9)', () => {
  it('Additional-tests a GLB loads into a root with its meshes and the bounds sphere of the model as it is', async () => {
    const result = await loadModelAsset(buildTriangleGlb({ positions: [10, 0, 0, 12, 0, 0, 10, 2, 0] }));
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const meshes: Mesh[] = [];
    result.value.root.traverse((object) => {
      if ((object as Mesh).isMesh) meshes.push(object as Mesh);
    });
    expect(meshes).toHaveLength(1);
    expect(result.value.bounds.center.toArray()).toEqual([11, 1, 0]); // not moved to the origin or scaled
    expect(result.value.bounds.radius).toBeCloseTo(Math.sqrt(2));
    expect(result.value.textures).toEqual([]);
  });

  it('Additional-tests a file that is not a GLB, a compressed GLB and a broken GLB each give their own error', async () => {
    expect(await loadModelAsset(new ArrayBuffer(8))).toMatchObject({ ok: false, error: { code: 'not-glb' } });
    expect(await loadModelAsset(buildTriangleGlb({ extensionsRequired: ['KHR_draco_mesh_compression'] }))).toMatchObject({ ok: false, error: { code: 'unsupported-compression' } });
    expect(await loadModelAsset(buildGlbFromJsonText('{"asset":{"version":"2.0"},"meshes":[{"primitives":[{"attributes":{"POSITION":7}}]}],"nodes":[{"mesh":0}],"scenes":[{"nodes":[0]}],"scene":0}'))).toMatchObject({ ok: false, error: { code: 'parse-failed' } });
  });

  it('Additional-tests a GLB with no mesh gives parse-failed instead of an empty model', async () => {
    const empty = buildGlbFromJsonText('{"asset":{"version":"2.0"},"scenes":[{"nodes":[]}],"scene":0}');
    expect(await loadModelAsset(empty)).toMatchObject({ ok: false, error: { code: 'parse-failed' } });
  });

  it('textures R13 the materials keep what the file gave them: loading lays no picture over them', async () => {
    const result = await loadModelAsset(buildTriangleGlb());
    if (!result.ok) throw new Error('load failed');
    let material!: MeshStandardMaterial;
    result.value.root.traverse((object) => {
      if ((object as Mesh).isMesh) material = (object as Mesh).material as MeshStandardMaterial;
    });
    expect(material.map).toBeNull();
  });

  it('textures R13 the asset lists its materials in order with their names (an unnamed one is Material N), and keeps those very materials', async () => {
    const two = '{"asset":{"version":"2.0"},"scene":0,"scenes":[{"nodes":[0]}],"nodes":[{"mesh":0}],"meshes":[{"primitives":[{"attributes":{"POSITION":0},"material":0},{"attributes":{"POSITION":0},"material":1}]}],"materials":[{"name":"Body"},{}],"accessors":[{"bufferView":0,"componentType":5126,"count":3,"type":"VEC3","min":[0,0,0],"max":[2,2,0]}],"bufferViews":[{"buffer":0,"byteLength":36}],"buffers":[{"byteLength":36}]}';
    const result = await loadModelAsset(buildGlbFromJsonText(two, new Uint8Array(new Float32Array([0, 0, 0, 2, 0, 0, 0, 2, 0]).buffer)));
    if (!result.ok) throw new Error('load failed');
    expect(result.value.materials).toEqual([{ index: 0, name: 'Body' }, { index: 1, name: 'Material 1' }]);
    expect(result.value.sourceMaterials.map((material) => material.name)).toEqual(['Body', '']);
    const onMeshes: unknown[] = [];
    result.value.root.traverse((object) => {
      if ((object as Mesh).isMesh) onMeshes.push((object as Mesh).material);
    });
    expect(result.value.sourceMaterials).toEqual(onMeshes);
  });

  it('Additional-tests dispose releases the geometry and materials once and can be called twice', async () => {
    const result = await loadModelAsset(buildTriangleGlb());
    if (!result.ok) throw new Error('load failed');
    let mesh!: Mesh;
    result.value.root.traverse((object) => {
      if ((object as Mesh).isMesh) mesh = object as Mesh;
    });
    const disposeGeometry = vi.spyOn(mesh.geometry, 'dispose');
    const disposeMaterial = vi.spyOn(mesh.material as { dispose(): void }, 'dispose');
    result.value.dispose();
    result.value.dispose();
    expect(disposeGeometry).toHaveBeenCalledTimes(1);
    expect(disposeMaterial).toHaveBeenCalledTimes(1);
  });

  it('textures R13 dispose closes the decoded bitmaps of the file\'s own textures, once, and leaves other images alone', async () => {
    const result = await loadModelAsset(buildTriangleGlb());
    if (!result.ok) throw new Error('load failed');
    const material = result.value.sourceMaterials[0] as MeshStandardMaterial;
    const bitmap = { width: 2, height: 2, close: vi.fn() };
    const element = { width: 2, height: 2 };
    material.map = new Texture(bitmap as never);
    material.normalMap = new Texture(element as never);
    result.value.dispose();
    result.value.dispose();
    expect(bitmap.close).toHaveBeenCalledTimes(1);
  });
});
