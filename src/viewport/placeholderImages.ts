import type { Material, Source, Texture } from 'three';
import { sourceImageIndexOf } from './sourceImageTags';
import type { SourceImage } from './sourceImages';

export interface PlaceholderSwap {
  count: number; // how many pictures were swapped
  imageIndexOf(texture: Texture): number | undefined; // the file image a swapped texture shows; undefined for any other
  restore(): void; // gives every picture and type back
}

const texturesOf = (materials: readonly Material[]): Texture[] =>
  materials.flatMap((material) => Object.values(material).filter((value): value is Texture => (value as Texture | null)?.isTexture === true));

// The exporter builds a new picture from a metalness and a roughness map that are not the same texture, reading their pixels: a stand-in would be read as the picture.
const hasSeparateMetalAndRoughMaps = (materials: readonly Material[]): boolean =>
  materials.some((material) => {
    const { metalnessMap, roughnessMap } = material as { metalnessMap?: Texture | null; roughnessMap?: Texture | null };
    return Boolean(metalnessMap && roughnessMap && metalnessMap !== roughnessMap);
  });

function makeStandIn(): HTMLCanvasElement {
  const canvas = document.createElement('canvas');
  canvas.width = 1;
  canvas.height = 1;
  return canvas;
}

/**
 * R25: replaces the picture of every texture that shows an image of the file (and whose original bytes are in `originals`) with a 1x1 stand-in and
 * the original's type, so the exporter has nothing large to encode; the original bytes are put in afterwards. Textures sharing a picture share a stand-in.
 * Null, with nothing changed, when no texture qualifies or the exporter would read the pictures' pixels.
 */
export function swapInPlaceholders(materials: readonly Material[], originals: ReadonlyMap<number, SourceImage>): PlaceholderSwap | null {
  if (hasSeparateMetalAndRoughMaps(materials)) return null;
  const textures = texturesOf(materials).filter((texture) => {
    const index = sourceImageIndexOf(texture);
    return index !== undefined && originals.has(index);
  });
  if (textures.length === 0) return null;

  const originalData = new Map<Source, unknown>();
  const originalTypes = new Map<Texture, unknown>();
  const swapped = new Set<Texture>();
  for (const texture of textures) {
    if (!originalData.has(texture.source)) {
      originalData.set(texture.source, texture.source.data);
      texture.source.data = makeStandIn();
    }
    originalTypes.set(texture, texture.userData['mimeType']);
    texture.userData['mimeType'] = originals.get(sourceImageIndexOf(texture)!)!.mimeType;
    swapped.add(texture);
  }
  return {
    count: originalData.size,
    imageIndexOf: (texture) => (swapped.has(texture) ? sourceImageIndexOf(texture) : undefined),
    restore() {
      for (const [source, data] of originalData) source.data = data;
      for (const [texture, type] of originalTypes) texture.userData['mimeType'] = type;
      originalData.clear();
      originalTypes.clear();
      swapped.clear();
    },
  };
}
