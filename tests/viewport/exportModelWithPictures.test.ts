import { beforeAll, describe, expect, it } from 'vitest';
import { MeshStandardMaterial, Texture } from 'three';
import { exportModelWithPictures, writeTexturesAsPng } from '../../src/viewport/exportModelWithPictures';
import { installNodeFileReader } from '../support/installNodeFileReader';
import { buildTriangleGlb } from './glbBuilder';

beforeAll(installNodeFileReader);

async function glbJsonOf(blob: Blob): Promise<{ materials?: unknown[]; images?: unknown[] }> {
  const bytes = new Uint8Array(await blob.arrayBuffer());
  const view = new DataView(bytes.buffer);
  const jsonLength = view.getUint32(12, true);
  return JSON.parse(new TextDecoder().decode(bytes.subarray(20, 20 + jsonLength)));
}

describe('exportModelWithPictures (textures R15)', () => {
  it('textures R15 a model with no pictures to lay over is written as a binary glTF', async () => {
    const result = await exportModelWithPictures(buildTriangleGlb(), []);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.type).toBe('model/gltf-binary');
    expect(new TextDecoder().decode(new Uint8Array(await result.value.arrayBuffer()).subarray(0, 4))).toBe('glTF');
    expect((await glbJsonOf(result.value)).images ?? []).toEqual([]);
  });

  it('textures R15 a file that is not a model gives its own error and a compressed one is named', async () => {
    expect(await exportModelWithPictures(new ArrayBuffer(8), [])).toMatchObject({ ok: false, error: { code: 'not-glb' } });
    expect(await exportModelWithPictures(buildTriangleGlb({ extensionsRequired: ['KHR_draco_mesh_compression'] }), [])).toMatchObject({ ok: false, error: { code: 'unsupported-compression' } });
  });

  it('textures R15 an extension the exporter does not carry fails the download and names it', async () => {
    const result = await exportModelWithPictures(buildTriangleGlb({ extensionsUsed: ['VENDOR_made_up'] }), []);
    expect(result).toMatchObject({ ok: false, error: { code: 'export-failed' } });
    if (!result.ok) expect(result.error.message).toMatch(/VENDOR_made_up/);
  });

  it('textures R15 pictures stored as JPEG or WebP are written as PNG, and a PNG is left alone', () => {
    const jpeg = new Texture();
    const webp = new Texture();
    const png = new Texture();
    jpeg.userData['mimeType'] = 'image/jpeg';
    webp.userData['mimeType'] = 'image/webp';
    png.userData['mimeType'] = 'image/png';
    const material = new MeshStandardMaterial({ map: jpeg, normalMap: webp, roughnessMap: png });
    writeTexturesAsPng([material]);
    expect([jpeg, webp, png].map((texture) => texture.userData['mimeType'])).toEqual(['image/png', 'image/png', 'image/png']);
  });

  it('textures R15 a picture that cannot be decoded gives picture-unreadable and names its slot', async () => {
    const result = await exportModelWithPictures(buildTriangleGlb(), [{ materialIndex: 0, channel: 'albedo', blob: new Blob(['not an image']) }]);
    expect(result).toMatchObject({ ok: false, error: { code: 'picture-unreadable' } });
    if (!result.ok) expect(result.error.message).toMatch(/albedo/);
  });
});
