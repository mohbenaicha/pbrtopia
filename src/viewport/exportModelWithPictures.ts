import { exportSceneGlb } from './exportSceneGlb';
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

export { writeTexturesAsPng } from './exportSceneGlb';

/**
 * The model as a binary glTF with the given pictures laid over its materials. Works on its own scratch copy of the model (no renderer, never the shown scene).
 * The exporter itself packs roughness (green) and metal (blue) into one picture per material.
 */
export async function exportModelWithPictures(glb: ArrayBuffer, pictures: readonly PictureToLayOver[]): Promise<ViewportResult<Blob>> {
  const loaded = await loadModelAsset(glb, { includeHidden: true }); // mesh edit R28: the download keeps every triangle and carries no hidden marks
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
    const exported = await exportSceneGlb(asset.root, glb);
    if (!exported.ok) return failure('export-failed', exported.lostExtensions.length > 0 ? `The model could not be saved: its file uses ${exported.lostExtensions.join(', ')}, which a download cannot keep.` : exported.error.message);
    return { ok: true, value: new Blob([exported.value], { type: 'model/gltf-binary' }) };
  } catch (error) {
    return failure('export-failed', `The model could not be saved${error instanceof Error ? `: ${error.message}` : '.'}`);
  } finally {
    layers.release();
    asset.dispose();
  }
}
