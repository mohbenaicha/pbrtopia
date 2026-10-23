import type { Material, Mesh, Object3D, Texture } from 'three';

export type TextureChannel = 'albedo' | 'normal' | 'rough' | 'metal';

export interface ModelTextureRecord {
  materialName: string;
  materialIndex: number; // which material of the model carries the picture; two materials can share a name
  channel: TextureChannel;
  width: number;
  height: number;
  colorSpace: string;
  bytes: () => Promise<Blob>; // the picture as a PNG, made on request
}

type TexturedMaterial = Material & { map?: Texture | null; normalMap?: Texture | null; roughnessMap?: Texture | null; metalnessMap?: Texture | null };

const SLOTS: { channel: TextureChannel; key: 'map' | 'normalMap' | 'roughnessMap' | 'metalnessMap' }[] = [
  { channel: 'albedo', key: 'map' },
  { channel: 'normal', key: 'normalMap' },
  { channel: 'rough', key: 'roughnessMap' },
  { channel: 'metal', key: 'metalnessMap' },
];

type DrawableImage = CanvasImageSource & { width: number; height: number };

async function encodePng(image: DrawableImage): Promise<Blob> {
  const canvas = new OffscreenCanvas(image.width, image.height);
  canvas.getContext('2d')!.drawImage(image, 0, 0);
  return canvas.convertToBlob({ type: 'image/png' });
}

export function allMaterialsOf(root: Object3D): Material[] {
  const found = new Set<Material>();
  root.traverse((object) => {
    const material = (object as Mesh).isMesh ? (object as Mesh).material : undefined;
    if (material) (Array.isArray(material) ? material : [material]).forEach((entry) => found.add(entry));
  });
  return [...found];
}

// One entry for every picture a material carries; the same file used for two channels (glTF's metal and rough) is listed under both.
export function collectTextureInfos(root: Object3D): ModelTextureRecord[] {
  const infos: ModelTextureRecord[] = [];
  allMaterialsOf(root).forEach((material, index) => {
    for (const { channel, key } of SLOTS) {
      const texture = (material as TexturedMaterial)[key];
      const image = texture?.image as DrawableImage | undefined;
      if (!texture || !image) continue;
      infos.push({ materialName: material.name || `Material ${index + 1}`, materialIndex: index, channel, width: image.width, height: image.height, colorSpace: texture.colorSpace, bytes: () => encodePng(image) });
    }
  });
  return infos;
}
