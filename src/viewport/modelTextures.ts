import type { Material, Mesh, Object3D, Texture } from 'three';

export type TextureChannel = 'albedo' | 'normal' | 'rough' | 'metal' | 'occlusion';

export interface ModelTextureRecord {
  materialName: string;
  materialIndex: number; // which material of the model carries the picture; two materials can share a name
  channel: TextureChannel;
  width: number;
  height: number;
  colorSpace: string;
  bytes: () => Promise<Blob>; // the whole picture as a PNG, made on request
  preview?: () => Promise<Blob>; // what the enlarged card shows when it is not the whole picture: one channel of a packed picture as grey
  thumbnail: () => Promise<Blob>; // what the Materials grid shows: the preview (or the picture) reduced to THUMBNAIL_SIDE, made once and kept
  shows?: string; // names that channel for the enlarged card, for example "Occlusion: red channel"
}

type TexturedMaterial = Material & { map?: Texture | null; normalMap?: Texture | null; roughnessMap?: Texture | null; metalnessMap?: Texture | null; aoMap?: Texture | null };

interface Slot {
  channel: TextureChannel;
  key: 'map' | 'normalMap' | 'roughnessMap' | 'metalnessMap' | 'aoMap';
  pixelByte?: number; // glTF packs roughness in green, metalness in blue and occlusion in red: the preview is that byte of every pixel as grey
  shows?: string;
}

const SLOTS: Slot[] = [
  { channel: 'albedo', key: 'map' },
  { channel: 'normal', key: 'normalMap' },
  { channel: 'rough', key: 'roughnessMap', pixelByte: 1, shows: 'Roughness: green channel of metallicRoughness' },
  { channel: 'metal', key: 'metalnessMap', pixelByte: 2, shows: 'Metal: blue channel of metallicRoughness' },
  { channel: 'occlusion', key: 'aoMap', pixelByte: 0, shows: 'Occlusion: red channel' },
];

type DrawableImage = CanvasImageSource & { width: number; height: number };

const THUMBNAIL_SIDE = 256;

// The size whose longest side is THUMBNAIL_SIDE, keeping the proportions; a picture that is smaller already is not enlarged.
function thumbnailSizeOf(image: { width: number; height: number }): { width: number; height: number } {
  const scale = Math.min(1, THUMBNAIL_SIDE / Math.max(image.width, image.height));
  return { width: Math.max(1, Math.round(image.width * scale)), height: Math.max(1, Math.round(image.height * scale)) };
}

async function encodePng(image: DrawableImage): Promise<Blob> {
  const canvas = new OffscreenCanvas(image.width, image.height);
  canvas.getContext('2d')!.drawImage(image, 0, 0);
  return canvas.convertToBlob({ type: 'image/png' });
}

// One byte of every pixel (0 red, 1 green, 2 blue) written to all three colour bytes, so the picture is that channel alone as grey. With `size` the picture is reduced first, so the per-pixel loop runs on the small copy.
async function encodeChannelPng(image: DrawableImage, pixelByte: number, size?: { width: number; height: number }): Promise<Blob> {
  const { width, height } = size ?? image;
  const canvas = new OffscreenCanvas(width, height);
  const context = canvas.getContext('2d')!;
  if (size === undefined) context.drawImage(image, 0, 0);
  else context.drawImage(image, 0, 0, width, height);
  const pixels = context.getImageData(0, 0, width, height);
  const { data } = pixels;
  for (let at = 0; at < data.length; at += 4) {
    const value = data[at + pixelByte]!;
    data[at] = value;
    data[at + 1] = value;
    data[at + 2] = value;
    data[at + 3] = 255;
  }
  context.putImageData(pixels, 0, 0);
  return canvas.convertToBlob({ type: 'image/png' });
}

async function encodeScaledPng(image: DrawableImage, { width, height }: { width: number; height: number }): Promise<Blob> {
  const canvas = new OffscreenCanvas(width, height);
  canvas.getContext('2d')!.drawImage(image, 0, 0, width, height);
  return canvas.convertToBlob({ type: 'image/png' });
}

// Runs `make` the first time and hands the same result to every later call; a failure is not kept, so the next call tries again.
function makeOnce<T>(make: () => Promise<T>): () => Promise<T> {
  let made: Promise<T> | undefined;
  return () => {
    if (made === undefined) {
      made = make();
      made.catch(() => {
        made = undefined;
      });
    }
    return made;
  };
}

/** The kept thumbnail of a picture that is stored as a file: it is decoded straight to the reduced size, so the full-size pixels are never held. */
export function thumbnailOfFile(read: () => Promise<Blob>, width: number, height: number): () => Promise<Blob> {
  return makeOnce(async () => {
    const size = thumbnailSizeOf({ width, height });
    const bitmap = await createImageBitmap(await read(), { resizeWidth: size.width, resizeHeight: size.height, resizeQuality: 'medium' });
    try {
      return await encodeScaledPng(bitmap, size);
    } finally {
      bitmap.close();
    }
  });
}

export function allMaterialsOf(root: Object3D): Material[] {
  const found = new Set<Material>();
  root.traverse((object) => {
    const material = (object as Mesh).isMesh ? (object as Mesh).material : undefined;
    if (material) (Array.isArray(material) ? material : [material]).forEach((entry) => found.add(entry));
  });
  return [...found];
}

// One entry for every picture a material carries; the same file used for several channels (glTF's packed occlusion, roughness and metal) is listed under each.
export function collectTextureInfos(root: Object3D): ModelTextureRecord[] {
  const infos: ModelTextureRecord[] = [];
  allMaterialsOf(root).forEach((material, index) => {
    for (const { channel, key, pixelByte, shows } of SLOTS) {
      const texture = (material as TexturedMaterial)[key];
      const image = texture?.image as DrawableImage | undefined;
      if (!texture || !image) continue;
      const size = thumbnailSizeOf(image);
      infos.push({
        materialName: material.name || `Material ${index + 1}`,
        materialIndex: index,
        channel,
        width: image.width,
        height: image.height,
        colorSpace: texture.colorSpace,
        bytes: () => encodePng(image),
        thumbnail: makeOnce(() => (pixelByte === undefined ? encodeScaledPng(image, size) : encodeChannelPng(image, pixelByte, size))),
        ...(pixelByte === undefined ? {} : { preview: () => encodeChannelPng(image, pixelByte) }),
        ...(shows === undefined ? {} : { shows }),
      });
    }
  });
  return infos;
}
