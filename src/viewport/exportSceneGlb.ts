import type { Material, Object3D, Texture } from 'three';
import { GLTFExporter } from 'three/examples/jsm/exporters/GLTFExporter.js';
import { extensionsOfGlb } from './inspectGlb';
import { allMaterialsOf } from './modelTextures';
import { swapInPlaceholders } from './placeholderImages';
import { readSourceImages, replaceImages } from './sourceImages';

// Extensions that only change how the numbers are stored: the exporter writes the same model as plain floats.
const WRITTEN_AS_PLAIN_DATA = ['KHR_mesh_quantization'];

// Optional hints the export leaves out on purpose: FB_ngon_encoding only records which triangles formed an n-gon (the triangles stay in the file), and an edit makes it stale.
const DROPPED_HINTS = ['FB_ngon_encoding'];

// What three's GLTFExporter writes itself when the scene uses it; any other extension a file declares would be dropped by an export.
const WRITTEN_BY_EXPORTER = [
  'KHR_texture_transform',
  'KHR_lights_punctual',
  'KHR_materials_unlit',
  'KHR_materials_clearcoat',
  'KHR_materials_dispersion',
  'KHR_materials_iridescence',
  'KHR_materials_transmission',
  'KHR_materials_volume',
  'KHR_materials_ior',
  'KHR_materials_specular',
  'KHR_materials_sheen',
  'KHR_materials_anisotropy',
  'KHR_materials_emissive_strength',
  'EXT_materials_bump',
  'EXT_mesh_gpu_instancing',
];

/** The extensions of a file that an export cannot keep (mesh edit R1: such a model cannot be saved after editing). */
export function extensionsLostOnExport(sourceGlb: ArrayBuffer): string[] {
  return (extensionsOfGlb(sourceGlb) ?? []).filter((name) => !WRITTEN_BY_EXPORTER.includes(name) && !WRITTEN_AS_PLAIN_DATA.includes(name) && !DROPPED_HINTS.includes(name));
}

/** Pictures stored as JPEG or WebP are written as PNG (textures R15): the exporter keeps a texture's own type unless told otherwise. */
export function writeTexturesAsPng(materials: readonly Material[]): void {
  for (const material of materials) {
    for (const value of Object.values(material)) {
      const texture = value as Texture | null;
      if (texture && texture.isTexture && texture.userData['mimeType'] !== undefined) texture.userData['mimeType'] = 'image/png';
    }
  }
}

export type SceneExport =
  | { ok: true; value: ArrayBuffer }
  | { ok: false; error: { code: 'export-failed'; message: string }; lostExtensions: string[] }; // lostExtensions: glTF extensions of the source the exporter could not write

interface ExportOptions {
  keepSourceImages?: boolean; // mesh edit R25: the scene was loaded from `sourceGlb`, so its own pictures are written back byte for byte instead of encoded again
}

/** R25: the scene exported with the file's own PNG and JPEG pictures put back as they were; null (the caller exports the usual way) when that cannot be done safely. */
async function exportKeepingSourceImages(scene: Object3D, materials: readonly Material[], sourceGlb: ArrayBuffer): Promise<ArrayBuffer | null> {
  const originals = readSourceImages(sourceGlb);
  const swap = originals.size > 0 ? swapInPlaceholders(materials, originals) : null;
  if (swap === null) return null;
  try {
    const exportedImageOf = new Map<number, number>(); // image index in the export -> image index in the source file
    let consistent = true;
    const exporter = new GLTFExporter().register(() => ({
      writeTexture(map: Texture, textureDef: { source?: number }) {
        const sourceIndex = swap.imageIndexOf(map);
        if (sourceIndex === undefined || textureDef.source === undefined) return;
        if (exportedImageOf.get(textureDef.source) !== undefined && exportedImageOf.get(textureDef.source) !== sourceIndex) consistent = false;
        exportedImageOf.set(textureDef.source, sourceIndex);
      },
    }));
    const withStandIns = await exporter.parseAsync(scene, { binary: true });
    if (!(withStandIns instanceof ArrayBuffer) || !consistent || exportedImageOf.size === 0) return null;
    const replacements = new Map([...exportedImageOf].map(([exportedIndex, sourceIndex]) => [exportedIndex, originals.get(sourceIndex)!] as const));
    return replaceImages(withStandIns, replacements);
  } catch {
    return null;
  } finally {
    swap.restore();
  }
}

/**
 * The scene as a binary glTF, pictures as PNG. `sourceGlb` is the file the scene came from: an extension it declares that the result lacks
 * would be lost silently, so the export is refused and the names are returned.
 */
export async function exportSceneGlb(scene: Object3D, sourceGlb: ArrayBuffer, options: ExportOptions = {}): Promise<SceneExport> {
  try {
    const materials = allMaterialsOf(scene);
    writeTexturesAsPng(materials);
    const exported = (options.keepSourceImages ? await exportKeepingSourceImages(scene, materials, sourceGlb) : null) ?? (await new GLTFExporter().parseAsync(scene, { binary: true }));
    if (!(exported instanceof ArrayBuffer)) return { ok: false, error: { code: 'export-failed', message: 'The model could not be saved: the exporter did not produce a file.' }, lostExtensions: [] };
    const carried = extensionsOfGlb(exported) ?? [];
    const lost = extensionsLostOnExport(sourceGlb).filter((name) => !carried.includes(name)); // one the exporter writes only when the scene needs it (emissive strength 1, an identity texture transform) is simply not needed
    if (lost.length > 0) return { ok: false, error: { code: 'export-failed', message: `The model could not be saved: its file uses ${lost.join(', ')}.` }, lostExtensions: lost };
    return { ok: true, value: exported };
  } catch (error) {
    return { ok: false, error: { code: 'export-failed', message: `The model could not be saved${error instanceof Error ? `: ${error.message}` : '.'}` }, lostExtensions: [] };
  }
}
