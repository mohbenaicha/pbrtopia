import { BufferAttribute, BufferGeometry, Scene, type Mesh } from 'three';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { createCameraRig } from '../../src/viewport/cameraRig';
import { createModelHost } from '../../src/viewport/modelHost';
import { DEFAULT_VIEWPORT_SETTINGS } from '../../src/viewport/viewportSettings';
import { buildTriangleGlb } from './glbBuilder';

afterEach(() => vi.useRealTimers());

// A quad of two triangles from x to x + 1 (four vertices, six indices).
function quadGeometry(x: number): BufferGeometry {
  const geometry = new BufferGeometry();
  geometry.setAttribute('position', new BufferAttribute(new Float32Array([x, 0, 0, x + 1, 0, 0, x + 1, 1, 0, x, 1, 0]), 3));
  geometry.setIndex(new BufferAttribute(Uint32Array.from([0, 1, 2, 0, 2, 3]), 1));
  return geometry;
}

function setup(settings = DEFAULT_VIEWPORT_SETTINGS) {
  const scene = new Scene();
  const rig = createCameraRig(1);
  rig.resetView();
  const onFramed = vi.fn();
  const onBounds = vi.fn();
  const host = createModelHost({ scene, rig, invalidate: vi.fn(), onFramed, onBounds, settings });
  return { scene, rig, onFramed, onBounds, host };
}

const drawnMesh = (scene: Scene): Mesh => {
  let found: Mesh | undefined;
  scene.traverse((object) => {
    if ((object as Mesh).isMesh && object.userData['isWireframeOverlay'] !== true && object.userData['isFlashOverlay'] !== true) found ??= object as Mesh;
  });
  return found!;
};

describe('model host replaceGeometry (mesh edit R25: the applied edits are swapped into the shown model)', () => {
  it('mesh edit R25 the shown mesh keeps its place in the scene and draws the new geometry, and the model is not loaded again', async () => {
    const { scene, host, onFramed } = setup();
    await host.load(buildTriangleGlb());
    const mesh = drawnMesh(scene);
    const asset = host.asset()!;
    onFramed.mockClear();
    const replacement = quadGeometry(5);

    expect(host.replaceGeometry([{ ordinal: 0, full: replacement, hidden: undefined }])).toBe(true);

    expect(drawnMesh(scene)).toBe(mesh);
    expect(host.asset()).toBe(asset);
    expect(mesh.geometry).toBe(replacement);
    expect(asset.meshes[0]!.full).toBe(replacement);
    expect(asset.meshes[0]!.hidden).toBeUndefined();
    expect(onFramed).not.toHaveBeenCalled(); // the camera stays where it is
  });

  it('mesh edit R25 R30 hidden triangles and the vertices only they used are left out of what is drawn, as when the file is loaded', async () => {
    const { scene, host } = setup();
    await host.load(buildTriangleGlb());
    const replacement = quadGeometry(0);

    host.replaceGeometry([{ ordinal: 0, full: replacement, hidden: Uint8Array.from([0, 1]) }]);

    const drawn = drawnMesh(scene).geometry;
    expect(drawn.index!.count).toBe(3);
    expect(drawn.getAttribute('position').count).toBe(3);
    const record = host.asset()!.meshes[0]!;
    expect(record.full).toBe(replacement); // the full triangle list stays for the next edit session
    expect(record.hidden).toEqual(Uint8Array.from([0, 1]));
  });

  it('mesh edit R25 the geometry the mesh drew before and the full geometry of the old model are freed', async () => {
    const { scene, host } = setup();
    await host.load(buildTriangleGlb());
    const oldFull = host.asset()!.meshes[0]!.full;
    const oldDrawn = drawnMesh(scene).geometry;
    const disposed = [vi.spyOn(oldFull, 'dispose'), vi.spyOn(oldDrawn, 'dispose')];

    host.replaceGeometry([{ ordinal: 0, full: quadGeometry(0), hidden: undefined }]);

    disposed.forEach((spy) => expect(spy).toHaveBeenCalled());
  });

  it('mesh edit R25 auto smooth builds its normals from the new geometry and Off draws the new geometry itself', async () => {
    vi.useFakeTimers();
    const { scene, host } = setup({ ...DEFAULT_VIEWPORT_SETTINGS, smoothAngleDeg: 30 });
    await host.load(buildTriangleGlb());
    const replacement = quadGeometry(7);

    host.replaceGeometry([{ ordinal: 0, full: replacement, hidden: undefined }]);

    const smoothed = drawnMesh(scene).geometry;
    expect(smoothed).not.toBe(replacement);
    expect(smoothed.getAttribute('normal')).toBeDefined();
    expect(Array.from(smoothed.getAttribute('position').array.slice(0, 3))).toEqual([7, 0, 0]);
    expect(Array.from(smoothed.getAttribute('normal').array.slice(0, 3))).toEqual([0, 0, 1]);

    host.setSettings({ smoothAngleDeg: 180 });
    vi.advanceTimersByTime(250);
    expect(drawnMesh(scene).geometry).toBe(replacement); // Off gives back the model's own geometry: the new one, not the old
  });

  it('mesh edit R25 the box of the shown model follows the new geometry (the ground grid and the next session\'s tolerance)', async () => {
    const { host, onBounds } = setup();
    await host.load(buildTriangleGlb());
    const before = host.asset()!.bounds.radius;

    host.replaceGeometry([{ ordinal: 0, full: quadGeometry(50), hidden: undefined }]);

    const box = onBounds.mock.calls.at(-1)![0] as { min: { x: number }; max: { x: number } };
    expect(box.min.x).toBeCloseTo(50);
    expect(box.max.x).toBeCloseTo(51);
    expect(host.asset()!.bounds.center.x).toBeCloseTo(50.5);
    expect(host.asset()!.bounds.radius).not.toBe(before);
  });

  it('mesh edit R25 a model whose lit look and shading mode were set keeps them', async () => {
    const { scene, host } = setup();
    await host.load(buildTriangleGlb());
    host.setShadingMode('albedo');
    const material = drawnMesh(scene).material;

    host.replaceGeometry([{ ordinal: 0, full: quadGeometry(0), hidden: undefined }]);

    expect(drawnMesh(scene).material).toBe(material);
  });

  it('mesh edit R25 with no model shown nothing is done and it says so', () => {
    const { host } = setup();
    expect(host.replaceGeometry([{ ordinal: 0, full: quadGeometry(0), hidden: undefined }])).toBe(false);
  });

  it('mesh edit R25 a mesh the shown model does not have refuses the whole swap and changes nothing', async () => {
    const { scene, host } = setup();
    await host.load(buildTriangleGlb());
    const before = drawnMesh(scene).geometry;
    const replacement = quadGeometry(0);

    expect(host.replaceGeometry([{ ordinal: 0, full: replacement, hidden: undefined }, { ordinal: 4, full: quadGeometry(2), hidden: undefined }])).toBe(false);

    expect(drawnMesh(scene).geometry).toBe(before);
    expect(host.asset()!.meshes[0]!.full).not.toBe(replacement);
  });
});
