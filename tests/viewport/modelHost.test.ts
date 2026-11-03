import { Raycaster, Scene, ShaderMaterial, type Mesh, type MeshBasicMaterial, type MeshStandardMaterial } from 'three';
import { describe, expect, it, vi } from 'vitest';
import { createCameraRig } from '../../src/viewport/cameraRig';
import { createModelHost } from '../../src/viewport/modelHost';
import { DEFAULT_VIEWPORT_SETTINGS } from '../../src/viewport/viewportSettings';
import { buildTriangleGlb } from './glbBuilder';

function setup() {
  const scene = new Scene();
  const rig = createCameraRig(1);
  rig.resetView();
  const invalidate = vi.fn();
  const onFramed = vi.fn();
  const host = createModelHost({ scene, rig, invalidate, onFramed, settings: DEFAULT_VIEWPORT_SETTINGS });
  return { scene, rig, invalidate, onFramed, host };
}

const meshesIn = (scene: Scene): Mesh[] => {
  const found: Mesh[] = [];
  scene.traverse((object) => {
    if ((object as Mesh).isMesh && object.userData['isWireframeOverlay'] !== true) found.push(object as Mesh);
  });
  return found;
};

const flashMeshesIn = (scene: Scene): Mesh[] => {
  const found: Mesh[] = [];
  scene.traverse((object) => {
    if ((object as Mesh).isMesh && object.userData['isFlashOverlay'] === true) found.push(object as Mesh);
  });
  return found;
};

describe('model host: grid bounds and the lit sliders', () => {
  it('R24 the box of a loaded model goes to onBounds, and null when it is removed', async () => {
    const onBounds = vi.fn();
    const host = createModelHost({ scene: new Scene(), rig: createCameraRig(1), invalidate: vi.fn(), onFramed: vi.fn(), onBounds, settings: DEFAULT_VIEWPORT_SETTINGS });
    await host.load(buildTriangleGlb());
    expect(onBounds).toHaveBeenLastCalledWith(expect.objectContaining({ isBox3: true }));
    host.unload();
    expect(onBounds).toHaveBeenLastCalledWith(null);
  });

  it('R14 the shown model\'s own materials are patched to read the Metal and Roughness sliders, and unpatched when it is removed', async () => {
    const { scene, host } = setup();
    await host.load(buildTriangleGlb());
    const material = meshesIn(scene)[0]!.material as unknown as { customProgramCacheKey(): string };
    expect(material.customProgramCacheKey()).toContain('lit-look-adjust');
    host.unload();
    expect(material.customProgramCacheKey()).not.toContain('lit-look-adjust');
  });
});

describe('model host: flat and smooth shading', () => {
  const materialOf = (scene: Scene): { flatShading: boolean } => meshesIn(scene)[0]!.material as unknown as { flatShading: boolean };

  it('R14 Flat sets flat shading on the model\'s materials, Smooth takes it off, and a model loaded later gets the current choice', async () => {
    vi.useFakeTimers();
    const { scene, host } = setup();
    await host.load(buildTriangleGlb()); // the test model has no normals, so the loader leaves it flat
    expect(materialOf(scene).flatShading).toBe(true);
    host.setSettings({ smoothAngleDeg: 30 }); // normals are built, so Smooth now shows smooth
    vi.advanceTimersByTime(250);
    expect(materialOf(scene).flatShading).toBe(false);
    host.setSettings({ flatShading: true });
    expect(materialOf(scene).flatShading).toBe(true);
    host.setSettings({ flatShading: false });
    expect(materialOf(scene).flatShading).toBe(false);
    host.setSettings({ flatShading: true, smoothAngleDeg: 180 });
    vi.advanceTimersByTime(250);
    await host.load(buildTriangleGlb());
    expect(materialOf(scene).flatShading).toBe(true);
    vi.useRealTimers();
  });

  it('R14 a model without normals stays flat under Smooth until the angle builds some', async () => {
    const { scene, host } = setup();
    await host.load(buildTriangleGlb());
    host.setSettings({ flatShading: false, smoothAngleDeg: 180 });
    expect(materialOf(scene).flatShading).toBe(true);
  });

  it('mesh edit R2 R18 an angle chosen while the geometry is locked leaves the meshes alone and is applied when it is unlocked', async () => {
    vi.useFakeTimers();
    const { scene, host } = setup();
    await host.load(buildTriangleGlb());
    const [mesh] = meshesIn(scene);
    const original = mesh!.geometry;
    host.lockGeometry(true);
    host.setSettings({ smoothAngleDeg: 30 });
    vi.advanceTimersByTime(250);
    expect(mesh!.geometry).toBe(original);
    host.lockGeometry(false);
    vi.advanceTimersByTime(250);
    expect(mesh!.geometry).not.toBe(original);
    vi.useRealTimers();
  });

  it('R14 an angle below 180 rebuilds the normals after the throttle, and 180 puts the model\'s own geometry back', async () => {
    vi.useFakeTimers();
    const { scene, host } = setup();
    await host.load(buildTriangleGlb());
    const [mesh] = meshesIn(scene);
    const original = mesh!.geometry;
    host.setSettings({ smoothAngleDeg: 30 });
    expect(mesh!.geometry).toBe(original); // waits for the throttle
    vi.advanceTimersByTime(250);
    expect(mesh!.geometry).not.toBe(original);
    host.setSettings({ smoothAngleDeg: 180 });
    vi.advanceTimersByTime(250);
    expect(mesh!.geometry).toBe(original);
    vi.useRealTimers();
  });

  it('R14 a model loaded when the angle is already below 180 is smoothed at once', async () => {
    const scene = new Scene();
    const rig = createCameraRig(1);
    rig.resetView();
    const host = createModelHost({ scene, rig, invalidate: vi.fn(), onFramed: vi.fn(), settings: { ...DEFAULT_VIEWPORT_SETTINGS, smoothAngleDeg: 30 } });
    await host.load(buildTriangleGlb());
    expect(meshesIn(scene)[0]!.geometry.getAttribute('normal')).toBeDefined(); // the test model has none of its own
    host.dispose();
    const plain = setup();
    await plain.host.load(buildTriangleGlb());
    expect(meshesIn(plain.scene)[0]!.geometry.getAttribute('normal')).toBeUndefined();
  });

  it('R14 the wireframe follows the rebuilt geometry, and unloading cancels a waiting rebuild', async () => {
    vi.useFakeTimers();
    const { scene, host } = setup();
    await host.load(buildTriangleGlb());
    host.setSettings({ wireframe: true });
    const [mesh] = meshesIn(scene);
    host.setSettings({ smoothAngleDeg: 30 });
    vi.advanceTimersByTime(250);
    const wire = mesh!.children.find((child) => child.userData['isWireframeOverlay'] === true) as Mesh;
    expect(wire.geometry).toBe(mesh!.geometry);
    host.setSettings({ smoothAngleDeg: 90 });
    host.unload();
    expect(vi.getTimerCount()).toBe(0);
    vi.useRealTimers();
  });
});

describe('model host', () => {
  it('R9 a loaded model is added to the scene, the camera is framed on it and a redraw is requested', async () => {
    const { scene, rig, invalidate, onFramed, host } = setup();
    const result = await host.load(buildTriangleGlb({ positions: [10, 0, 0, 12, 0, 0, 10, 2, 0] }));
    expect(result.ok).toBe(true);
    expect(meshesIn(scene)).toHaveLength(1);
    expect(rig.target.toArray()).toEqual([11, 1, 0]);
    expect(rig.radius).toBeCloseTo(Math.sqrt(2));
    expect(onFramed).toHaveBeenCalledTimes(1);
    expect(invalidate).toHaveBeenCalled();
  });

  it('R9 loading another model replaces the first, which is freed', async () => {
    const { scene, host } = setup();
    await host.load(buildTriangleGlb());
    const [first] = meshesIn(scene);
    const disposeFirst = vi.spyOn(first!.geometry, 'dispose');
    await host.load(buildTriangleGlb({ positions: [0, 0, 0, 1, 0, 0, 0, 1, 0] }));
    expect(meshesIn(scene)).toHaveLength(1);
    expect(meshesIn(scene)[0]).not.toBe(first);
    expect(disposeFirst).toHaveBeenCalledTimes(1);
  });

  it('R9 a failed load keeps the model that was shown and reports the error', async () => {
    const { scene, host } = setup();
    await host.load(buildTriangleGlb());
    const [shown] = meshesIn(scene);
    const result = await host.load(new ArrayBuffer(8));
    expect(result).toMatchObject({ ok: false, error: { code: 'not-glb' } });
    expect(meshesIn(scene)).toEqual([shown]);
  });

  it('R9 unload removes the model and frees it', async () => {
    const { scene, host, invalidate } = setup();
    await host.load(buildTriangleGlb());
    const [shown] = meshesIn(scene);
    const disposeGeometry = vi.spyOn(shown!.geometry, 'dispose');
    invalidate.mockClear();
    host.unload();
    expect(meshesIn(scene)).toHaveLength(0);
    expect(disposeGeometry).toHaveBeenCalledTimes(1);
    expect(invalidate).toHaveBeenCalled();
  });

  it('R15 the chosen shading mode is kept for the next model and can change while one is shown', async () => {
    const { scene, host } = setup();
    host.setShadingMode('rough');
    await host.load(buildTriangleGlb());
    expect(((meshesIn(scene)[0]!.material) as ShaderMaterial).isShaderMaterial).toBe(true);
    host.setShadingMode('lit');
    expect(((meshesIn(scene)[0]!.material) as ShaderMaterial).isShaderMaterial).toBeUndefined();
  });

  it('R17 a projection material replaces the look of the model, the shading mode is remembered but not shown, and clearing it restores the mode', async () => {
    const { scene, host, invalidate } = setup();
    await host.load(buildTriangleGlb());
    host.setShadingMode('rough');
    const roughLook = meshesIn(scene)[0]!.material;
    const projection = new ShaderMaterial();
    invalidate.mockClear();
    host.setProjectionMaterial(projection);
    expect(meshesIn(scene)[0]!.material).toBe(projection);
    expect(invalidate).toHaveBeenCalled();
    host.setShadingMode('metal');
    expect(meshesIn(scene)[0]!.material).toBe(projection);
    host.setProjectionMaterial(null);
    expect((meshesIn(scene)[0]!.material as ShaderMaterial).isShaderMaterial).toBe(true);
    expect(meshesIn(scene)[0]!.material).not.toBe(roughLook); // metal, the last mode chosen
    host.setShadingMode('lit');
    expect(((meshesIn(scene)[0]!.material) as ShaderMaterial).isShaderMaterial).toBeUndefined();
  });

  it('R17 a model loaded while a projection material is set shows it, and the wireframe overlay keeps its own material', async () => {
    const { scene, host } = setup();
    const projection = new ShaderMaterial();
    host.setSettings({ wireframe: true });
    host.setProjectionMaterial(projection);
    await host.load(buildTriangleGlb());
    expect(meshesIn(scene)[0]!.material).toBe(projection);
    const overlayMaterials: unknown[] = [];
    scene.traverse((object) => {
      if (object.userData['isWireframeOverlay'] === true) overlayMaterials.push((object as Mesh).material);
    });
    expect(overlayMaterials).toHaveLength(1);
    expect(overlayMaterials[0]).not.toBe(projection);
  });

  it('R16 a flash material is laid over the projection material, which stays on the model; taking it away leaves the projection material alone', async () => {
    const { scene, host } = setup();
    await host.load(buildTriangleGlb());
    const projection = new ShaderMaterial();
    const flash = new ShaderMaterial();
    host.setProjectionMaterial(projection);
    host.setFlashMaterial(flash);
    expect(meshesIn(scene)[0]!.material).toBe(projection);
    expect(flashMeshesIn(scene).map((mesh) => mesh.material)).toEqual([flash]);
    host.setFlashMaterial(null);
    expect(meshesIn(scene)[0]!.material).toBe(projection);
    expect(flashMeshesIn(scene)).toHaveLength(0);
    host.setProjectionMaterial(null);
    host.setFlashMaterial(flash);
    host.setFlashMaterial(null);
    expect(((meshesIn(scene)[0]!.material) as ShaderMaterial).isShaderMaterial).toBeUndefined();
  });

  it('R16 the flash copies of the meshes are never picked, share the geometry, and the same material set again adds no second copy', async () => {
    const { scene, host } = setup();
    await host.load(buildTriangleGlb());
    const flash = new ShaderMaterial();
    host.setFlashMaterial(flash);
    host.setFlashMaterial(flash);
    const [copy] = flashMeshesIn(scene);
    expect(flashMeshesIn(scene)).toHaveLength(1);
    expect(copy!.geometry).toBe(meshesIn(scene)[0]!.geometry);
    const hits: unknown[] = [];
    copy!.raycast(new Raycaster(), hits as never);
    expect(hits).toHaveLength(0);
  });

  it('R16 a flash changing to another material, or the model being removed, leaves no copy behind', async () => {
    const { scene, host } = setup();
    await host.load(buildTriangleGlb());
    const other = new ShaderMaterial();
    host.setFlashMaterial(new ShaderMaterial());
    host.setFlashMaterial(other);
    expect(flashMeshesIn(scene).map((mesh) => mesh.material)).toEqual([other]);
    host.unload();
    expect(flashMeshesIn(scene)).toHaveLength(0);
  });

  it('R17 the model root is reported while a model is shown and not after it is removed', async () => {
    const { host } = setup();
    expect(host.root()).toBeUndefined();
    await host.load(buildTriangleGlb());
    expect(host.root()).toBeDefined();
    host.unload();
    expect(host.root()).toBeUndefined();
  });

  it('R14 the wireframe setting adds and removes the overlay, including on a model loaded after it was set', async () => {
    const { scene, host } = setup();
    const overlayCount = (): number => {
      let count = 0;
      scene.traverse((object) => {
        if (object.userData['isWireframeOverlay'] === true) count += 1;
      });
      return count;
    };
    host.setSettings({ wireframe: true });
    await host.load(buildTriangleGlb());
    expect(overlayCount()).toBe(1);
    host.setSettings({ wireframe: false });
    expect(overlayCount()).toBe(0);
  });

  it('R14 changing the map adjust settings requests a redraw and builds no materials', async () => {
    const { host, invalidate, scene } = setup();
    host.setShadingMode('metal');
    await host.load(buildTriangleGlb());
    const look = meshesIn(scene)[0]!.material;
    invalidate.mockClear();
    host.setSettings({ mapAdjust: { ...DEFAULT_VIEWPORT_SETTINGS.mapAdjust, metalStrength: 2 } });
    expect(invalidate).toHaveBeenCalled();
    expect(meshesIn(scene)[0]!.material).toBe(look);
    expect((look as ShaderMaterial).uniforms['uStrength']!.value).toBe(2);
  });
});

describe('model host: material pictures', () => {
  const bitmap = (): ImageBitmap => ({ width: 2, height: 2, close: vi.fn() }) as unknown as ImageBitmap;
  const sourceOf = (scene: Scene): MeshStandardMaterial => meshesIn(scene)[0]!.material as MeshStandardMaterial;

  it('textures R13 a picture set on a slot shows on the lit material and asks for a redraw; null puts the file\'s map back', async () => {
    const { scene, host, invalidate } = setup();
    await host.load(buildTriangleGlb());
    const material = sourceOf(scene);
    invalidate.mockClear();
    host.setMaterialPicture(0, 'albedo', { id: 'p1', bitmap: bitmap() });
    expect(material.map).not.toBeNull();
    expect(invalidate).toHaveBeenCalled();
    host.setMaterialPicture(0, 'albedo', null);
    expect(material.map).toBeNull();
  });

  it('textures R13 the flat looks pick the new picture up too, without a rebuild by the caller', async () => {
    const { scene, host } = setup();
    await host.load(buildTriangleGlb());
    host.setShadingMode('albedo');
    const before = meshesIn(scene)[0]!.material as MeshBasicMaterial;
    expect(before.map).toBeNull();
    host.setMaterialPicture(0, 'albedo', { id: 'p1', bitmap: bitmap() });
    const after = meshesIn(scene)[0]!.material as MeshBasicMaterial;
    expect(after.isMeshBasicMaterial).toBe(true);
    expect(after.map).not.toBeNull(); // a look of its own, built from the changed source
    host.setShadingMode('lit');
    expect(sourceOf(scene).map).toBe(after.map);
  });

  it('textures R13 with a projection material set the picture is still stored, and shows when the projection material is cleared', async () => {
    const { scene, host } = setup();
    await host.load(buildTriangleGlb());
    const projection = new ShaderMaterial();
    host.setProjectionMaterial(projection);
    host.setMaterialPicture(0, 'normal', { id: 'n1', bitmap: bitmap() });
    expect(meshesIn(scene)[0]!.material).toBe(projection);
    host.setProjectionMaterial(null);
    expect(sourceOf(scene).normalMap).not.toBeNull();
  });

  it('textures R13 a picture handed over when no model is shown is closed and nothing breaks', () => {
    const { host } = setup();
    const stray = bitmap();
    host.setMaterialPicture(0, 'albedo', { id: 'p1', bitmap: stray });
    expect(stray.close).toHaveBeenCalledTimes(1);
  });

  it('textures R13 removing or replacing the model puts the originals back and frees the pictures; the next model starts with none', async () => {
    const { scene, host } = setup();
    await host.load(buildTriangleGlb());
    const picture = bitmap();
    host.setMaterialPicture(0, 'albedo', { id: 'p1', bitmap: picture });
    await host.load(buildTriangleGlb());
    expect(picture.close).toHaveBeenCalledTimes(1);
    expect(sourceOf(scene).map).toBeNull();
    const second = bitmap();
    host.setMaterialPicture(0, 'albedo', { id: 'p1', bitmap: second });
    host.unload();
    expect(second.close).toHaveBeenCalledTimes(1);
  });
});
