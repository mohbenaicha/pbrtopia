import { DoubleSide, FrontSide, Mesh, PerspectiveCamera, Scene, Vector3, type BufferGeometry, type MeshPhysicalMaterial } from 'three';
import { describe, expect, it, vi } from 'vitest';
import { DEFAULT_PREVIEW_PREFS, DEFAULT_PREVIEW_VALUES } from '@mat/storage';
import { createPreviewScene, type PreviewHost } from '../../../../src/materialgen/preview/scene/createPreviewScene';

function fakeHost(aspect = 1.5): PreviewHost & { camera: PerspectiveCamera; placed: number } {
  const camera = new PerspectiveCamera(40, aspect, 0.01, 100);
  const host = {
    scene: new Scene(),
    camera,
    placed: 0,
    rig: {
      perspective: camera,
      target: new Vector3(),
      placeCamera(direction: Vector3, distance: number) {
        camera.position.copy(direction).normalize().multiplyScalar(distance);
        camera.lookAt(0, 0, 0);
        host.placed += 1;
      },
    },
    invalidate: vi.fn(),
  };
  return host as PreviewHost & { camera: PerspectiveCamera; placed: number };
}

const make = (patch: Partial<typeof DEFAULT_PREVIEW_PREFS> = {}) => {
  const host = fakeHost();
  const scene = createPreviewScene(host, { ...DEFAULT_PREVIEW_PREFS, meshResolution: 1, ...patch }, DEFAULT_PREVIEW_VALUES);
  return { host, scene };
};
const meshes = (host: PreviewHost) => host.scene.getObjectByName('previewGroup')!.children.filter((child): child is Mesh => (child as Mesh).isMesh);

describe('materialgen/preview R1 R2 R6 the group and its one mesh', () => {
  it('R1 R2 adds one previewGroup holding exactly one mesh, the ball by default', () => {
    const { host } = make();
    expect(host.scene.children.filter((child) => child.name === 'previewGroup')).toHaveLength(1);
    expect(meshes(host)).toHaveLength(1);
    const position = meshes(host)[0]!.geometry.getAttribute('position');
    expect(Math.hypot(position.getX(5), position.getY(5), position.getZ(5))).toBeCloseTo(0.5, 5);
  });

  it('R4 switching the mesh keeps the shared material and disposes the geometry of the one that was left', () => {
    const { host, scene } = make();
    const first = meshes(host)[0]!;
    const material = first.material as MeshPhysicalMaterial;
    const disposed = vi.fn();
    first.geometry.addEventListener('dispose', disposed);
    scene.setMesh('plane');
    expect(disposed).toHaveBeenCalledTimes(1);
    expect(meshes(host)).toHaveLength(1);
    expect(meshes(host)[0]!.material).toBe(material);
    scene.setMesh('materialBall');
    expect(meshes(host)[0]!.material).toBe(material);
  });

  it('R2 the Plane is drawn on both faces, the Ball and the Material ball on their outer faces only, in the shaded and in a flat view', () => {
    const { host, scene } = make();
    const sideOf = () => (meshes(host)[0]!.material as MeshPhysicalMaterial).side;
    expect(sideOf()).toBe(FrontSide);
    scene.setMesh('plane');
    expect(sideOf()).toBe(DoubleSide);
    scene.setShading('albedo');
    expect(sideOf()).toBe(DoubleSide);
    scene.setMesh('materialBall');
    expect(sideOf()).toBe(FrontSide);
    scene.setShading('lit');
    expect(sideOf()).toBe(FrontSide);
    scene.setMesh('plane');
    expect(sideOf()).toBe(DoubleSide);
  });

  it('R57 only the Material ball is textured by position: its mesh turns the triplanar uniform on (one repeat per unit), the Ball and the Plane turn it off, in the shaded and in a flat view', () => {
    const { host, scene } = make();
    const shadedValue = (): number => {
      const shader = { uniforms: {} as Record<string, { value: number }>, vertexShader: '', fragmentShader: '' };
      (meshes(host)[0]!.material as unknown as { onBeforeCompile(shader: unknown, renderer: unknown): void }).onBeforeCompile(shader, undefined);
      return shader.uniforms['uTriplanar']!.value;
    };
    expect(shadedValue()).toBe(0);
    scene.setMesh('materialBall');
    expect(shadedValue()).toBe(1);
    scene.setShading('albedo');
    expect((meshes(host)[0]!.material as unknown as { uniforms: Record<string, { value: number }> }).uniforms['uTriplanar']!.value).toBe(1);
    scene.setMesh('plane');
    expect((meshes(host)[0]!.material as unknown as { uniforms: Record<string, { value: number }> }).uniforms['uTriplanar']!.value).toBe(0);
  });

  it('R57 a scene that starts on the Material ball is textured by position from the first frame', () => {
    const { host } = make({ mesh: 'materialBall' });
    const shader = { uniforms: {} as Record<string, { value: number }>, vertexShader: '', fragmentShader: '' };
    (meshes(host)[0]!.material as unknown as { onBeforeCompile(shader: unknown, renderer: unknown): void }).onBeforeCompile(shader, undefined);
    expect(shader.uniforms['uTriplanar']!.value).toBe(1);
  });

  it('R60 the normal direction reaches the shaded and the flat materials, and a scene starts with the saved one', () => {
    const flipOf = (host: ReturnType<typeof make>['host']): number => {
      const shader = { uniforms: {} as Record<string, { value: number }>, vertexShader: '', fragmentShader: '' };
      (meshes(host)[0]!.material as unknown as { onBeforeCompile(shader: unknown, renderer: unknown): void }).onBeforeCompile(shader, undefined);
      return shader.uniforms['uNormalFlipY']!.value;
    };
    const { host, scene } = make();
    expect(flipOf(host)).toBe(0);
    scene.setNormalDirection('directx');
    expect(flipOf(host)).toBe(1);
    scene.setShading('normal');
    expect((meshes(host)[0]!.material as unknown as { uniforms: Record<string, { value: number }> }).uniforms['uNormalFlipY']!.value).toBe(1);
    scene.setNormalDirection('opengl');
    expect((meshes(host)[0]!.material as unknown as { uniforms: Record<string, { value: number }> }).uniforms['uNormalFlipY']!.value).toBe(0);
    expect(flipOf(make({ normalDirection: 'directx' }).host)).toBe(1);
  });

  it('R2 a scene that starts on the Plane draws it on both faces', () => {
    const { host } = make({ mesh: 'plane' });
    expect((meshes(host)[0]!.material as MeshPhysicalMaterial).side).toBe(DoubleSide);
  });

  it('R4 switching the mesh returns it to its default pose and the dolly to its default distance', () => {
    const { host, scene } = make({ mesh: 'plane' });
    scene.turn(80, 30, 400);
    scene.dolly(-3);
    scene.setMesh('ball');
    expect(scene.view()).toEqual({ mesh: 'ball', yaw: 0, pitch: 0, dolly: 1 });
    expect(meshes(host)[0]!.parent!.rotation.y).toBe(0);
  });

  it('R6 disposing removes previewGroup and disposes the geometry, material and textures', () => {
    const { host, scene } = make();
    scene.bind({ albedo: { width: 2, height: 2, channels: 1, data: new Uint8Array(4) } });
    const mesh = meshes(host)[0]!;
    const material = mesh.material as MeshPhysicalMaterial;
    const geometry = vi.fn();
    const texture = vi.fn();
    mesh.geometry.addEventListener('dispose', geometry);
    material.map!.addEventListener('dispose', texture);
    scene.dispose();
    expect(host.scene.getObjectByName('previewGroup')).toBeUndefined();
    expect(geometry).toHaveBeenCalledTimes(1);
    expect(texture).toHaveBeenCalledTimes(1);
  });
});

describe('materialgen/preview R39 resolution', () => {
  it('R39 changing the resolution rebuilds the geometry once and disposes the old one', () => {
    const { host, scene } = make();
    const old: BufferGeometry = meshes(host)[0]!.geometry;
    const disposed = vi.fn();
    old.addEventListener('dispose', disposed);
    scene.setResolution(4);
    expect(disposed).toHaveBeenCalledTimes(1);
    expect(meshes(host)[0]!.geometry).not.toBe(old);
    scene.setResolution(4);
    expect(meshes(host)[0]!.geometry.getAttribute('position').count).toBe(meshes(host)[0]!.geometry.getAttribute('position').count);
  });

  it('R39 the same resolution does not rebuild', () => {
    const { host, scene } = make();
    const same = meshes(host)[0]!.geometry;
    scene.setResolution(1);
    expect(meshes(host)[0]!.geometry).toBe(same);
  });
});

describe('materialgen/preview R49 frames on demand', () => {
  it('R49 every kind of change asks for a frame, and an idle scene asks for none', () => {
    const { host, scene } = make();
    const invalidate = vi.mocked(host.invalidate);
    const changes: Array<[string, () => void]> = [
      ['values', () => scene.setValues({ ...DEFAULT_PREVIEW_VALUES, tilingX: 3 })],
      ['maps', () => scene.bind({ rough: { width: 1, height: 1, channels: 1, data: new Uint8Array([9]) } })],
      ['map adjust', () => scene.setMapAdjust({ normalStrength: 2 })],
      ['ao intensity', () => scene.setAoIntensity(0.4)],
      ['mesh', () => scene.setMesh('plane')],
      ['view mode', () => scene.setShading('albedo')],
      ['drag', () => scene.turn(30, 10, 400)],
      ['wheel', () => scene.dolly(1)],
      ['resize', () => scene.fitCamera()],
    ];
    for (const [name, change] of changes) {
      invalidate.mockClear();
      change();
      expect(invalidate, `a ${name} change draws a frame`).toHaveBeenCalled();
    }
    invalidate.mockClear();
    expect(invalidate, 'nothing is drawn while idle').not.toHaveBeenCalled();
  });
});

describe('materialgen/preview R62 plane orbit', () => {
  const flat = (host: PreviewHost): number[] => {
    const rotation = host.scene.getObjectByName('previewGroup')!.rotation;
    return [rotation.x, rotation.y, rotation.z];
  };

  it('R62 the plane lies flat and the camera looks down at it at 45 degrees from the front', () => {
    const { host, scene } = make({ mesh: 'plane' });
    expect(flat(host)).toEqual([-Math.PI / 2, 0, 0]);
    const { x, y, z } = host.camera.position;
    expect(x).toBeCloseTo(0, 6);
    expect(y).toBeCloseTo(z, 6);
    expect(y).toBeGreaterThan(0);
    expect(scene.view()).toMatchObject({ mesh: 'plane', yaw: 0, pitch: Math.PI / 4, dolly: 1 });
  });

  it('R62 a drag moves only the camera: the plane keeps its rotation, the distance stays, and one frame is asked for', () => {
    const { host, scene } = make({ mesh: 'plane' });
    const distance = host.camera.position.length();
    (host.invalidate as ReturnType<typeof vi.fn>).mockClear();
    scene.turn(60, 30, 400);
    expect(flat(host)).toEqual([-Math.PI / 2, 0, 0]);
    expect(host.camera.position.length()).toBeCloseTo(distance, 6);
    expect(host.camera.position.x).not.toBeCloseTo(0, 3);
    expect(host.invalidate).toHaveBeenCalledTimes(1);
    scene.turn(0, 0, 400);
    expect(host.invalidate).toHaveBeenCalledTimes(1);
  });

  it('R62 the camera never goes below the plane or straight above it', () => {
    const { host, scene } = make({ mesh: 'plane' });
    scene.turn(0, -100000, 400);
    expect(host.camera.position.y).toBeGreaterThan(0);
    const low = Math.atan2(host.camera.position.y, Math.hypot(host.camera.position.x, host.camera.position.z));
    expect(low).toBeCloseTo((5 * Math.PI) / 180, 6);
    scene.turn(0, 100000, 400);
    const high = Math.atan2(host.camera.position.y, Math.hypot(host.camera.position.x, host.camera.position.z));
    expect(high).toBeCloseTo((85 * Math.PI) / 180, 6);
  });

  it('R62 R23 Reset view returns the plane to its default view; pressed again it asks for no frame', () => {
    const { host, scene } = make({ mesh: 'plane' });
    scene.turn(60, 20, 400);
    scene.dolly(-4);
    scene.resetView();
    expect(scene.view()).toMatchObject({ yaw: 0, pitch: Math.PI / 4, dolly: 1 });
    (host.invalidate as ReturnType<typeof vi.fn>).mockClear();
    scene.resetView();
    expect(host.invalidate).not.toHaveBeenCalled();
  });

  it('R62 R4 choosing the plane puts it flat and choosing the ball turns it back to the upright default; both come back to their own default view', () => {
    const { host, scene } = make();
    scene.turn(60, 20, 400);
    scene.setMesh('plane');
    expect(flat(host)).toEqual([-Math.PI / 2, 0, 0]);
    expect(scene.view()).toMatchObject({ mesh: 'plane', yaw: 0, pitch: Math.PI / 4 });
    scene.turn(60, 20, 400);
    scene.setMesh('ball');
    expect(flat(host)).toEqual([0, 0, 0]);
    expect(scene.view()).toMatchObject({ mesh: 'ball', yaw: 0, pitch: 0 });
    expect(host.camera.position.x).toBeCloseTo(0, 6);
    expect(host.camera.position.y).toBeCloseTo(0, 6);
  });

  it('R62 R53 the thumbnail of the plane is taken square-on from the front, and the orbit view comes back afterwards', async () => {
    const { host, scene } = make({ mesh: 'plane' });
    scene.turn(60, 20, 400);
    const before = { position: host.camera.position.clone(), rotation: flat(host), view: scene.view() };
    const seen = { rotation: [9, 9, 9], position: new Vector3() };
    await scene.captureThumbnail(async () => {
      seen.rotation = flat(host);
      seen.position = host.camera.position.clone();
      return new Blob(['x']);
    });
    expect(seen.rotation).toEqual([0, 0, 0]);
    expect(seen.position.x).toBeCloseTo(0, 6);
    expect(seen.position.y).toBeCloseTo(0, 6);
    expect(seen.position.z).toBeGreaterThan(0);
    expect(flat(host)).toEqual(before.rotation);
    expect(host.camera.position.distanceTo(before.position)).toBeCloseTo(0, 6);
    expect(scene.view()).toEqual(before.view);
  });
});

describe('materialgen/preview R20 R22 R23 pose, dolly and Reset view', () => {
  it('R20 a drag turns the group and asks for one frame; a zero drag asks for none', () => {
    const { host, scene } = make();
    (host.invalidate as ReturnType<typeof vi.fn>).mockClear();
    scene.turn(0, 0, 400);
    expect(host.invalidate).not.toHaveBeenCalled();
    scene.turn(50, 0, 400);
    expect(host.invalidate).toHaveBeenCalledTimes(1);
    expect(host.scene.getObjectByName('previewGroup')!.rotation.y).toBeGreaterThan(0);
  });

  it('R22 the dolly moves only the camera, between 0.4 and 3 times the default distance, and never the mesh', () => {
    const { host, scene } = make();
    const group = host.scene.getObjectByName('previewGroup')!;
    const start = host.camera.position.length();
    for (let i = 0; i < 100; i += 1) scene.dolly(1);
    expect(host.camera.position.length()).toBeCloseTo(start * 3, 6);
    for (let i = 0; i < 200; i += 1) scene.dolly(-1);
    expect(host.camera.position.length()).toBeCloseTo(start * 0.4, 6);
    expect(group.position.toArray()).toEqual([0, 0, 0]);
  });

  it('R23 Reset view returns pose and dolly; pressed again it changes nothing and asks for no frame', () => {
    const { host, scene } = make();
    scene.turn(60, 20, 400);
    scene.dolly(-4);
    scene.resetView();
    expect(scene.view()).toMatchObject({ yaw: 0, pitch: 0, dolly: 1 });
    (host.invalidate as ReturnType<typeof vi.fn>).mockClear();
    scene.resetView();
    expect(host.invalidate).not.toHaveBeenCalled();
  });

  it('R5 the default distance follows the viewport shape: a narrow viewport sits further back than a wide one', () => {
    const wide = make().host.camera.position.length();
    const narrowHost = fakeHost(0.5);
    createPreviewScene(narrowHost, { ...DEFAULT_PREVIEW_PREFS, meshResolution: 1 }, DEFAULT_PREVIEW_VALUES);
    expect(narrowHost.camera.position.length()).toBeGreaterThan(wide);
  });

  it('R5 fitCamera follows a new aspect and keeps the dolly the user chose', () => {
    const { host, scene } = make();
    scene.dolly(-2);
    const factor = scene.view().dolly;
    host.camera.aspect = 0.5;
    scene.fitCamera();
    expect(scene.view().dolly).toBe(factor);
    expect(host.camera.position.length()).toBeGreaterThan(0);
  });
});

describe('materialgen/preview R51 R56 view modes on the scene', () => {
  const grey = { width: 2, height: 2, channels: 1 as const, data: new Uint8Array(4).fill(50) };

  it('R51 a flat view swaps the mesh material and Shaded brings the shared material back, without touching the pose, dolly or mesh', () => {
    const { host, scene } = make();
    const mesh = meshes(host)[0]!;
    const lit = mesh.material;
    scene.turn(40, 10, 400);
    scene.dolly(1);
    const before = scene.view();
    scene.setShading('rough');
    expect(mesh.material).not.toBe(lit);
    expect((mesh.material as { isShaderMaterial?: boolean }).isShaderMaterial).toBe(true);
    expect(scene.view()).toEqual(before);
    scene.setShading('lit');
    expect(mesh.material).toBe(lit);
    expect(scene.view()).toEqual(before);
  });

  it('R51 each mode draws one frame', () => {
    const { host, scene } = make();
    const invalidate = vi.mocked(host.invalidate);
    invalidate.mockClear();
    scene.setShading('height');
    expect(invalidate).toHaveBeenCalledTimes(1);
  });

  it('R51 R52 a flat view keeps the displacement and maps of the bound working copies, also when they change while it is shown', () => {
    const { host, scene } = make();
    const mesh = meshes(host)[0]!;
    scene.setShading('height');
    scene.bind({ height: grey });
    const uniforms = (mesh.material as unknown as { uniforms: Record<string, { value: unknown }> }).uniforms;
    expect(uniforms.uHasMap!.value).toBe(true);
    expect(uniforms.uHasHeight!.value).toBe(true);
    scene.setValues({ ...DEFAULT_PREVIEW_VALUES, heightScale: 0.08 });
    expect(uniforms.uDisplacementScale!.value).toBeCloseTo(0.08 / 1, 6);
  });

  it('R51 the mode stays when the mesh changes', () => {
    const { host, scene } = make();
    scene.setShading('albedo');
    scene.setMesh('plane');
    expect((meshes(host)[0]!.material as { isShaderMaterial?: boolean }).isShaderMaterial).toBe(true);
    expect(scene.shading()).toBe('albedo');
  });
});

describe('materialgen/preview R18 R40 the mask overlay on the scene', () => {
  const labels = { width: 2, height: 2, channels: 1 as const, data: new Uint8Array(4).fill(3) };
  const palette = [{ label: 3, hex: '#00aa55', name: 'Moss' }];
  const maskOn = (host: PreviewHost): number => {
    const shader = { uniforms: {} as Record<string, { value: number }>, vertexShader: '', fragmentShader: '' };
    (meshes(host)[0]!.material as unknown as { onBeforeCompile(shader: unknown, renderer: unknown): void }).onBeforeCompile(shader, undefined);
    return shader.uniforms['uMaskOn']!.value;
  };

  it('R18 shows the palette colours on the shaded mesh once the labels, the palette and the switch are there', () => {
    const { host, scene } = make();
    scene.setMaskOverlay({ on: true, opacity: 0.5, palette });
    expect(maskOn(host)).toBe(0); // no labels
    scene.bind({ labels });
    expect(maskOn(host)).toBe(1);
    scene.setMaskOverlay({ on: false, opacity: 0.5, palette });
    expect(maskOn(host)).toBe(0);
  });

  it('R18 a change of the overlay draws one frame', () => {
    const { host, scene } = make();
    const invalidate = vi.mocked(host.invalidate);
    invalidate.mockClear();
    scene.setMaskOverlay({ on: true, opacity: 0.2, palette });
    expect(invalidate).toHaveBeenCalledTimes(1);
  });

  it('R53 the thumbnail never shows the overlay, and it is back on afterwards', async () => {
    const { host, scene } = make();
    scene.bind({ labels });
    scene.setMaskOverlay({ on: true, opacity: 0.5, palette });
    let during = -1;
    await scene.captureThumbnail(async () => {
      during = maskOn(host);
      return new Blob(['x']);
    });
    expect(during).toBe(0);
    expect(maskOn(host)).toBe(1);
  });
});

describe('materialgen/preview R53 the thumbnail view', () => {
  const blob = new Blob(['jpeg']);

  it('R53 the capture sees the lit view at the default pose and dolly, and the user sees the same view as before afterwards', async () => {
    const { host, scene } = make();
    const defaultDistance = host.camera.position.z;
    scene.turn(60, 20, 400);
    scene.dolly(1);
    scene.setShading('albedo');
    const group = host.scene.getObjectByName('previewGroup')!;
    const litMaterial = meshes(host)[0]!.material;
    const seen = { rotation: [0, 0], z: 0, shading: '', material: litMaterial };
    const before = { view: scene.view(), z: host.camera.position.z, material: meshes(host)[0]!.material };
    const result = await scene.captureThumbnail(async () => {
      seen.rotation = [group.rotation.x, group.rotation.y];
      seen.z = host.camera.position.z;
      seen.shading = scene.shading();
      seen.material = meshes(host)[0]!.material;
      return blob;
    });
    expect(result).toBe(blob);
    expect(seen.rotation).toEqual([0, 0]);
    expect(seen.z).toBeCloseTo(defaultDistance, 6);
    expect(seen.shading).toBe('lit');
    expect((seen.material as { isMeshPhysicalMaterial?: boolean }).isMeshPhysicalMaterial).toBe(true);
    expect(scene.view()).toEqual(before.view);
    expect(host.camera.position.z).toBeCloseTo(before.z, 6);
    expect(meshes(host)[0]!.material).toBe(before.material);
    expect(scene.shading()).toBe('albedo');
  });

  it('R53 a failed capture still puts the view back', async () => {
    const { host, scene } = make();
    scene.turn(60, 0, 400);
    const before = scene.view();
    await expect(scene.captureThumbnail(() => Promise.reject(new Error('no canvas')))).rejects.toThrow('no canvas');
    expect(scene.view()).toEqual(before);
    expect(vi.mocked(host.invalidate)).toHaveBeenCalled();
  });

  it('R53 while the user is dragging the capture waits for the drag to end and never shows the dragged pose', async () => {
    const { scene } = make();
    const capture = vi.fn(async () => blob);
    scene.setDragging(true);
    const pending = scene.captureThumbnail(capture);
    await Promise.resolve();
    expect(capture).not.toHaveBeenCalled();
    scene.setDragging(false);
    await pending;
    expect(capture).toHaveBeenCalledTimes(1);
  });

  it('R53 a capture that was waiting for a drag when the preview went never runs, and touches nothing of the removed scene', async () => {
    const { scene } = make();
    const capture = vi.fn(async () => blob);
    scene.setDragging(true);
    const pending = scene.captureThumbnail(capture);
    scene.dispose();
    scene.setDragging(false); // the controls letting go as they are detached
    await expect(pending).rejects.toThrow();
    expect(capture).not.toHaveBeenCalled();
  });
});

describe('materialgen/preview R58 R59 the tool view on the scene', () => {
  const CROP = { kind: 'crop', rect: { x: 0.1, y: 0, width: 0.9, height: 1 }, edge: null } as const;

  it('R58 setting a transform shows it in the next frame and clearing it removes it', () => {
    const { host, scene } = make();
    vi.mocked(host.invalidate).mockClear();
    scene.setToolTransform(CROP);
    expect(scene.toolTransform()).toBe(CROP);
    expect(vi.mocked(host.invalidate)).toHaveBeenCalledTimes(1);
    scene.setToolTransform(null);
    expect(scene.toolTransform()).toBeNull();
  });

  it('R58 the project thumbnail is taken without the transform, which comes back after', async () => {
    const { scene } = make();
    scene.setToolTransform(CROP);
    let during: unknown = 'unset';
    await scene.captureThumbnail(async () => {
      during = scene.toolTransform();
      return new Blob(['x']);
    });
    expect(during).toBeNull();
    expect(scene.toolTransform()).toBe(CROP);
  });
});
