import type { Material, Texture } from 'three';
import { GLTFExporter } from 'three/examples/jsm/exporters/GLTFExporter.js';
import { extensionsOfGlb } from './inspectGlb';
import { loadModelAsset } from './loadModelAsset';
import { createMaterialPictures, type OverrideChannel } from './materialPictures';
import type { ViewportResult } from './viewportError';

export interface PictureToLayOver {
  materialIndex: number;
  channel: OverrideChannel;
  blob: Blob;
}

const failure = (code: 'export-failed' | 'picture-unreadable', message: string): { ok: false; error: { code: typeof code; message: string } } => ({ ok: false, error: { code, message } });

// Decoded as stored: no colour conversion and no premultiplication, as the viewport decodes them.
const decode = (blob: Blob): Promise<ImageBitmap> => createImageBitmap(blob, { colorSpaceConversion: 'none', premultiplyAlpha: 'none' });

// Extensions that only change how the numbers are stored: the exporter writes the same model as plain floats.
const WRITTEN_AS_PLAIN_DATA = ['KHR_mesh_quantization'];

/** Pictures stored as JPEG or WebP are written as PNG (textures R15): the exporter keeps a texture's own type unless told otherwise. */
export function writeTexturesAsPng(materials: readonly Material[]): void {
  for (const material of materials) {
    for (const value of Object.values(material)) {
      const texture = value as Texture | null;
      if (texture && texture.isTexture && texture.userData['mimeType'] !== undefined) texture.userData['mimeType'] = 'image/png';
    }
  }
}

/**
 * The model as a binary glTF with the given pictures laid over its materials. Works on its own scratch copy of the model (no renderer, never the shown scene).
 * The exporter itself packs roughness (green) and metal (blue) into one picture per material.
 */
export async function exportModelWithPictures(glb: ArrayBuffer, pictures: readonly PictureToLayOver[]): Promise<ViewportResult<Blob>> {
  const loaded = await loadModelAsset(glb);
  if (!loaded.ok) return loaded;
  const asset = loaded.value;
  const layers = createMaterialPictures(asset.sourceMaterials, () => undefined);
  try {
    const decoded = new Map<Blob, { id: string; bitmap: ImageBitmap }>(); // a picture used by several materials is decoded once and becomes one image
    for (const picture of pictures) {
      let entry = decoded.get(picture.blob);
      if (!entry) {
        try {
          entry = { id: `picture-${decoded.size}`, bitmap: await decode(picture.blob) };
        } catch {
          return failure('picture-unreadable', `The ${picture.channel} picture for material ${picture.materialIndex} could not be read.`);
        }
        decoded.set(picture.blob, entry);
      }
      layers.set(picture.materialIndex, picture.channel, entry);
    }
    writeTexturesAsPng(asset.sourceMaterials);
    const exported = await new GLTFExporter().parseAsync(asset.root, { binary: true });
    if (!(exported instanceof ArrayBuffer)) return failure('export-failed', 'The model could not be saved: the exporter did not produce a file.');
    const carried = extensionsOfGlb(exported) ?? [];
    const lost = (extensionsOfGlb(glb) ?? []).filter((name) => !carried.includes(name) && !WRITTEN_AS_PLAIN_DATA.includes(name));
    if (lost.length > 0) return failure('export-failed', `The model could not be saved: its file uses ${lost.join(', ')}, which a download cannot keep.`);
    return { ok: true, value: new Blob([exported], { type: 'model/gltf-binary' }) };
  } catch (error) {
    return failure('export-failed', `The model could not be saved${error instanceof Error ? `: ${error.message}` : '.'}`);
  } finally {
    layers.release();
    asset.dispose();
  }
}
