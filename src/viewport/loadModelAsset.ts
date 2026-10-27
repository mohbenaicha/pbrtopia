import { Box3, Sphere, type Texture, type Vector3, type Material, type Mesh, type Object3D } from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { inspectGlb } from './inspectGlb';
import { allMaterialsOf, collectTextureInfos, type ModelTextureRecord } from './modelTextures';
import type { ViewportResult } from './viewportError';

export interface ModelAsset {
  root: Object3D;
  textures: ModelTextureRecord[];
  materials: ModelMaterialRecord[]; // the file's materials in the order a slot's materialIndex counts them
  sourceMaterials: readonly Material[]; // the same materials, as the file gave them: before any look or picture is laid over them
  bounds: { center: Vector3; radius: number }; // of the model as loaded: it is not moved or scaled
  dispose(): void;
}

export interface ModelMaterialRecord {
  index: number;
  name: string; // the file's name, or Material N when it has none
}

// The loader hands out decoded bitmaps where the browser can: they hold memory until closed (a bitmap may be reached by several textures; closing twice is harmless).
function releaseTexture(texture: Texture): void {
  texture.dispose();
  const image = texture.image as { close?: unknown } | null;
  if (image !== null && typeof image === 'object' && typeof image.close === 'function') (image as ImageBitmap).close();
}

function releaseMaterial(material: Material): void {
  Object.values(material).forEach((value) => {
    if (value && (value as Texture).isTexture) releaseTexture(value as Texture);
  });
  material.dispose();
}

// Reads a self-contained GLB into a scene graph with its own materials and textures.
export async function loadModelAsset(glb: ArrayBuffer): Promise<ViewportResult<ModelAsset>> {
  const inspection = inspectGlb(glb);
  if (!inspection.ok) return { ok: false, error: { code: inspection.code, message: inspection.message } };

  let root: Object3D;
  try {
    root = (await new GLTFLoader().parseAsync(glb, '')).scene;
  } catch (error) {
    return { ok: false, error: { code: 'parse-failed', message: `This model could not be read${error instanceof Error ? `: ${error.message}` : '.'}` } };
  }
  root.updateMatrixWorld(true);

  const meshes: Mesh[] = [];
  root.traverse((object) => {
    if ((object as Mesh).isMesh) meshes.push(object as Mesh);
  });
  if (meshes.length === 0) return { ok: false, error: { code: 'parse-failed', message: 'This model has no mesh to show.' } };

  const textures = collectTextureInfos(root); // the file's own pictures, listed before any picture is laid over them
  const sourceMaterials = allMaterialsOf(root);
  const materials = sourceMaterials.map((material, index) => ({ index, name: material.name || `Material ${index}` }));
  const sphere = new Box3().setFromObject(root).getBoundingSphere(new Sphere());
  let released = false;
  return {
    ok: true,
    value: {
      root,
      textures,
      materials,
      sourceMaterials,
      bounds: { center: sphere.center, radius: sphere.radius },
      dispose() {
        if (released) return;
        released = true;
        meshes.forEach((mesh) => mesh.geometry.dispose());
        allMaterialsOf(root).forEach(releaseMaterial);
      },
    },
  };
}
