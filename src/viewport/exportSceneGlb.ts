import type { Material, Object3D, Texture } from 'three';
import { GLTFExporter } from 'three/examples/jsm/exporters/GLTFExporter.js';
import { extensionsOfGlb } from './inspectGlb';
import { allMaterialsOf } from './modelTextures';

// Extensions that only change how the numbers are stored: the exporter writes the same model as plain floats.
const WRITTEN_AS_PLAIN_DATA = ['KHR_mesh_quantization'];

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
  return (extensionsOfGlb(sourceGlb) ?? []).filter((name) => !WRITTEN_BY_EXPORTER.includes(name) && !WRITTEN_AS_PLAIN_DATA.includes(name));
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

/**
 * The scene as a binary glTF, pictures as PNG. `sourceGlb` is the file the scene came from: an extension it declares that the result lacks
 * would be lost silently, so the export is refused and the names are returned.
 */
export async function exportSceneGlb(scene: Object3D, sourceGlb: ArrayBuffer): Promise<SceneExport> {
  try {
    writeTexturesAsPng(allMaterialsOf(scene));
    const exported = await new GLTFExporter().parseAsync(scene, { binary: true });
    if (!(exported instanceof ArrayBuffer)) return { ok: false, error: { code: 'export-failed', message: 'The model could not be saved: the exporter did not produce a file.' }, lostExtensions: [] };
    const carried = extensionsOfGlb(exported) ?? [];
    const lost = extensionsLostOnExport(sourceGlb).filter((name) => !carried.includes(name)); // one the exporter writes only when the scene needs it (emissive strength 1, an identity texture transform) is simply not needed
    if (lost.length > 0) return { ok: false, error: { code: 'export-failed', message: `The model could not be saved: its file uses ${lost.join(', ')}.` }, lostExtensions: lost };
    return { ok: true, value: exported };
  } catch (error) {
    return { ok: false, error: { code: 'export-failed', message: `The model could not be saved${error instanceof Error ? `: ${error.message}` : '.'}` }, lostExtensions: [] };
  }
}
