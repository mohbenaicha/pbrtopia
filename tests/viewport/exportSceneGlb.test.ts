import { Group, Mesh, MeshStandardMaterial, PlaneGeometry } from 'three';
import { beforeAll, describe, expect, it } from 'vitest';
import { exportSceneGlb, extensionsLostOnExport } from '../../src/viewport/exportSceneGlb';
import { installNodeFileReader } from '../support/installNodeFileReader';
import { buildTriangleGlb } from './glbBuilder';

beforeAll(installNodeFileReader);

const sceneWithOnePlane = (): Group => {
  const group = new Group();
  group.add(new Mesh(new PlaneGeometry(1, 1), new MeshStandardMaterial()));
  return group;
};

describe('extensionsLostOnExport (mesh edit R1)', () => {
  it('mesh edit R1 names an extension the exporter cannot write and passes the ones it can', () => {
    expect(extensionsLostOnExport(buildTriangleGlb({ extensionsUsed: ['VENDOR_made_up', 'KHR_materials_clearcoat', 'KHR_mesh_quantization'] }))).toEqual(['VENDOR_made_up']);
  });
});

describe('exportSceneGlb (mesh edit R25)', () => {
  it('mesh edit R25 writes the scene as a binary glTF', async () => {
    const result = await exportSceneGlb(sceneWithOnePlane(), buildTriangleGlb());
    expect(result.ok).toBe(true);
  });

  it('mesh edit R25 keeping the source pictures on a scene with none to keep (no images in the file) falls back to the usual export and succeeds', async () => {
    const result = await exportSceneGlb(sceneWithOnePlane(), buildTriangleGlb(), { keepSourceImages: true });
    expect(result.ok).toBe(true);
  });

  it('mesh edit R1 R25 an extension the source declares that the exporter cannot write refuses the save also when pictures are kept', async () => {
    const result = await exportSceneGlb(sceneWithOnePlane(), buildTriangleGlb({ extensionsUsed: ['VENDOR_made_up'] }), { keepSourceImages: true });
    expect(result).toMatchObject({ ok: false, lostExtensions: ['VENDOR_made_up'] });
  });

  it('mesh edit R1 R25 an extension the source declares that the exporter writes only when the scene needs it does not stop the save', async () => {
    const result = await exportSceneGlb(sceneWithOnePlane(), buildTriangleGlb({ extensionsUsed: ['KHR_materials_emissive_strength'] }));
    expect(result.ok).toBe(true);
  });

  it('mesh edit R25 an extension the exporter cannot write refuses the save and names it', async () => {
    const result = await exportSceneGlb(sceneWithOnePlane(), buildTriangleGlb({ extensionsUsed: ['VENDOR_made_up'] }));
    expect(result).toMatchObject({ ok: false, lostExtensions: ['VENDOR_made_up'] });
  });
});
