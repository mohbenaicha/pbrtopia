import { BoxGeometry, Group, Mesh, MeshBasicMaterial, MeshStandardMaterial, NoColorSpace, SRGBColorSpace, Texture, type ColorSpace } from 'three';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { allMaterialsOf, collectTextureInfos } from '../../src/viewport/modelTextures';

const pictureOf = (width: number, height: number, colorSpace: ColorSpace = NoColorSpace): Texture => {
  const texture = new Texture({ width, height } as unknown as HTMLImageElement);
  texture.colorSpace = colorSpace;
  return texture;
};
const meshOf = (material: MeshStandardMaterial | MeshStandardMaterial[]): Mesh => new Mesh(new BoxGeometry(), material);

describe('allMaterialsOf', () => {
  it('viewport-layout R6 lists each material of every mesh once, however many meshes or slots share it', () => {
    const shared = new MeshStandardMaterial({ name: 'skin' });
    const other = new MeshStandardMaterial({ name: 'metal' });
    const root = new Group();
    root.add(meshOf(shared), meshOf([shared, other]));
    const nested = new Group();
    nested.add(meshOf(other));
    root.add(nested);
    expect(allMaterialsOf(root)).toEqual([shared, other]);
  });

  it('viewport-layout R6 gives nothing for a model without meshes', () => {
    expect(allMaterialsOf(new Group())).toEqual([]);
  });
});

describe('collectTextureInfos', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('viewport-layout R6 lists one entry for every picture a material carries, with its channel, size and colour space', () => {
    const material = new MeshStandardMaterial({ name: 'skin' });
    material.map = pictureOf(1024, 512, SRGBColorSpace);
    material.normalMap = pictureOf(256, 256);
    const root = meshOf(material);
    const infos = collectTextureInfos(root);
    expect(infos.map(({ materialName, materialIndex, channel, width, height, colorSpace }) => ({ materialName, materialIndex, channel, width, height, colorSpace }))).toEqual([
      { materialName: 'skin', materialIndex: 0, channel: 'albedo', width: 1024, height: 512, colorSpace: SRGBColorSpace },
      { materialName: 'skin', materialIndex: 0, channel: 'normal', width: 256, height: 256, colorSpace: NoColorSpace },
    ]);
  });

  it('viewport-layout R6 the same file used for rough and metal is listed under both channels', () => {
    const material = new MeshStandardMaterial({ name: 'gltf' });
    const packed = pictureOf(64, 64);
    material.roughnessMap = packed;
    material.metalnessMap = packed;
    expect(collectTextureInfos(meshOf(material)).map((info) => info.channel)).toEqual(['rough', 'metal']);
  });

  it('viewport-layout R6 a material without pictures, or a texture with no image yet, gives no entry', () => {
    const bare = new MeshStandardMaterial({ name: 'bare' });
    const empty = new MeshStandardMaterial({ name: 'empty' });
    empty.map = new Texture();
    expect(collectTextureInfos(meshOf([bare, empty]))).toEqual([]);
  });

  it('viewport-layout R6 materials are numbered in model order, and an unnamed one is called Material <number>', () => {
    const first = new MeshStandardMaterial();
    const second = new MeshStandardMaterial({ name: 'named' });
    first.map = pictureOf(8, 8);
    second.map = pictureOf(8, 8);
    const infos = collectTextureInfos(meshOf([first, second]));
    expect(infos.map(({ materialName, materialIndex }) => [materialName, materialIndex])).toEqual([
      ['Material 1', 0],
      ['named', 1],
    ]);
  });

  it('viewport-layout R6 two materials with the same name stay apart by their index', () => {
    const a = new MeshStandardMaterial({ name: 'twin' });
    const b = new MeshStandardMaterial({ name: 'twin' });
    a.map = pictureOf(8, 8);
    b.map = pictureOf(8, 8);
    expect(collectTextureInfos(meshOf([a, b])).map((info) => info.materialIndex)).toEqual([0, 1]);
  });

  it('viewport-layout R6 a basic material with a colour map is listed as albedo', () => {
    const material = new MeshBasicMaterial({ name: 'flat', map: pictureOf(32, 16, SRGBColorSpace) });
    const infos = collectTextureInfos(new Mesh(new BoxGeometry(), material));
    expect(infos.map((info) => [info.channel, info.width, info.height])).toEqual([['albedo', 32, 16]]);
  });

  it('viewport-layout R6 the picture bytes are made only on request, as a PNG of the texture size', async () => {
    const drawImage = vi.fn();
    const convertToBlob = vi.fn(async (options: { type: string }) => new Blob(['png'], { type: options.type }));
    const constructed: number[][] = [];
    class FakeCanvas {
      constructor(width: number, height: number) {
        constructed.push([width, height]);
      }
      getContext() {
        return { drawImage };
      }
      convertToBlob = convertToBlob;
    }
    vi.stubGlobal('OffscreenCanvas', FakeCanvas);
    const material = new MeshStandardMaterial({ name: 'skin' });
    const image = { width: 40, height: 30 };
    material.map = new Texture(image as unknown as HTMLImageElement);
    const [info] = collectTextureInfos(meshOf(material));
    expect(constructed).toEqual([]);
    const blob = await info!.bytes();
    expect(constructed).toEqual([[40, 30]]);
    expect(drawImage).toHaveBeenCalledWith(image, 0, 0);
    expect(blob.type).toBe('image/png');
  });
});
