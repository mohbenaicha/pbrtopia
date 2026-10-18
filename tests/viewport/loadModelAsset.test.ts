import type { Mesh } from 'three';
import { describe, expect, it, vi } from 'vitest';
import { loadModelAsset } from '../../src/viewport/loadModelAsset';
import { buildGlbFromJsonText, buildTriangleGlb } from './glbBuilder';

describe('loadModelAsset', () => {
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
});
