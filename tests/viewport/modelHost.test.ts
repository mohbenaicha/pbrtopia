import { Scene, ShaderMaterial, type Mesh } from 'three';
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

  it('R17 a flash material shows on top of the projection material and taking it away shows the projection material again', async () => {
    const { scene, host } = setup();
    await host.load(buildTriangleGlb());
    const projection = new ShaderMaterial();
    const flash = new ShaderMaterial();
    host.setProjectionMaterial(projection);
    host.setFlashMaterial(flash);
    expect(meshesIn(scene)[0]!.material).toBe(flash);
    host.setFlashMaterial(null);
    expect(meshesIn(scene)[0]!.material).toBe(projection);
    host.setProjectionMaterial(null);
    host.setFlashMaterial(flash);
    host.setFlashMaterial(null);
    expect(((meshesIn(scene)[0]!.material) as ShaderMaterial).isShaderMaterial).toBeUndefined();
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
