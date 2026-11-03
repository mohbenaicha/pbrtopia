import { Box3, Sphere, type BufferGeometry, type Texture, type Vector3, type Material, type Mesh, type Object3D } from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { flagsFromRanges, MESH_EDIT_KEY, readHiddenMarks } from '../meshEdit/model/hiddenMarks';
import { removeHiddenTriangles } from '../meshEdit/model/removeHiddenTriangles';
import { inspectGlb } from './inspectGlb';
import { allMaterialsOf, collectTextureInfos, type ModelTextureRecord } from './modelTextures';
import type { ViewportResult } from './viewportError';

/** One mesh of the model as loaded: what is drawn can lack hidden triangles (mesh edit R30), `full` never does. */
export interface ModelMeshRecord {
  mesh: Mesh;
  ordinal: number; // index among the model's meshes in traversal order: the key of the hidden marks
  full: BufferGeometry; // the geometry with every triangle
  hidden: Uint8Array | undefined; // 1 per hidden triangle of `full`; undefined = none hidden
}

export interface ModelAsset {
  root: Object3D;
  meshes: ModelMeshRecord[];
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

interface LoadModelAssetOptions {
  includeHidden?: boolean; // draw every triangle and drop the hidden marks (the model download, Generate UV)
}

// Reads a self-contained GLB into a scene graph with its own materials and textures. Hidden triangles (mesh edit R12) are left out of what is drawn.
export async function loadModelAsset(glb: ArrayBuffer, options: LoadModelAssetOptions = {}): Promise<ViewportResult<ModelAsset>> {
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

  const marks = options.includeHidden ? new Map() : readHiddenMarks(root.userData);
  if (options.includeHidden) delete root.userData[MESH_EDIT_KEY];
  const records: ModelMeshRecord[] = meshes.map((mesh, ordinal) => {
    const full = mesh.geometry;
    const hidden = marks.has(ordinal) ? flagsFromRanges(marks.get(ordinal), (full.index ? full.index.count : full.getAttribute('position').count) / 3) : undefined;
    if (hidden) mesh.geometry = removeHiddenTriangles(full, hidden);
    return { mesh, ordinal, full, hidden };
  });
  if (records.every((record) => record.hidden !== undefined && record.mesh.geometry.getAttribute('position').count === 0)) {
    return { ok: false, error: { code: 'parse-failed', message: 'Every part of this model is hidden.' } };
  }

  const textures = collectTextureInfos(root); // the file's own pictures, listed before any picture is laid over them
  const sourceMaterials = allMaterialsOf(root);
  const materials = sourceMaterials.map((material, index) => ({ index, name: material.name || `Material ${index}` }));
  const sphere = new Box3().setFromObject(root).getBoundingSphere(new Sphere());
  let released = false;
  return {
    ok: true,
    value: {
      root,
      meshes: records,
      textures,
      materials,
      sourceMaterials,
      bounds: { center: sphere.center, radius: sphere.radius },
      dispose() {
        if (released) return;
        released = true;
        records.forEach((record) => {
          if (record.mesh.geometry !== record.full) record.mesh.geometry.dispose();
          record.full.dispose();
        });
        allMaterialsOf(root).forEach(releaseMaterial);
      },
    },
  };
}
