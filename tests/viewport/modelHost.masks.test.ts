import { Scene, type Mesh } from 'three';
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
  const host = createModelHost({ scene, rig, invalidate, onFramed: vi.fn(), settings: DEFAULT_VIEWPORT_SETTINGS });
  return { scene, invalidate, host };
}

const maskCopies = (scene: Scene): Mesh[] => {
  const found: Mesh[] = [];
  scene.traverse((object) => {
    if (object.userData['isMaskOverlay'] === true) found.push(object as Mesh);
  });
  return found;
};

const STATE = { labels: new Uint8Array([0, 1, 1, 0]), size: 2, palette: [{ hex: '#ff0000' }, { hex: '#00ff00' }], on: true, opacity: 0.5, highlight: null };

describe('model host: the mask overlay (mask-mode R20)', () => {
  it('mask-mode R20 shows the overlay over the model and takes it away', async () => {
    const { scene, host, invalidate } = setup();
    await host.load(buildTriangleGlb());
    invalidate.mockClear();
    host.setMaskOverlay(STATE);
    expect(maskCopies(scene)).toHaveLength(1);
    expect(invalidate).toHaveBeenCalled();
    host.setMaskOverlay(null);
    expect(maskCopies(scene)).toHaveLength(0);
  });

  it('mask-mode R20 it works in every shading look and with a projection material set', async () => {
    const { scene, host } = setup();
    await host.load(buildTriangleGlb());
    host.setMaskOverlay(STATE);
    for (const look of ['lit', 'flat', 'albedo', 'rough', 'metal'] as const) {
      host.setShadingMode(look as never);
      expect(maskCopies(scene)).toHaveLength(1);
    }
  });

  it('mask-mode R20 a model loaded after the overlay was set shows it too, and an unloaded model leaves no copy', async () => {
    const { scene, host } = setup();
    host.setMaskOverlay(STATE);
    await host.load(buildTriangleGlb());
    expect(maskCopies(scene)).toHaveLength(1);
    host.unload();
    expect(maskCopies(scene)).toHaveLength(0);
  });

  it('mask-mode R20 replaced geometry gets fresh copies that share it', async () => {
    const { scene, host } = setup();
    await host.load(buildTriangleGlb());
    host.setMaskOverlay(STATE);
    const asset = host.asset()!;
    const record = asset.meshes[0]!;
    host.replaceGeometry([{ ordinal: record.ordinal, full: record.full.clone(), hidden: undefined }]);
    const copies = maskCopies(scene);
    expect(copies).toHaveLength(1);
    expect(copies[0]!.geometry).toBe(record.mesh.geometry);
  });
});
