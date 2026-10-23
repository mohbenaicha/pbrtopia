import { Box3, Sphere, Vector3, type Material, type Mesh, type Object3D, type Texture } from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { inspectGlb } from './inspectGlb';
import { allMaterialsOf, collectTextureInfos, type ModelTextureRecord } from './modelTextures';
import type { ViewportResult } from './viewportError';

export interface ModelAsset {
  root: Object3D;
  textures: ModelTextureRecord[];
  bounds: { center: Vector3; radius: number }; // of the model as loaded: it is not moved or scaled
  dispose(): void;
}

function releaseMaterial(material: Material): void {
  Object.values(material).forEach((value) => {
    if (value && (value as Texture).isTexture) (value as Texture).dispose();
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

  const sphere = new Box3().setFromObject(root).getBoundingSphere(new Sphere());
  let released = false;
  return {
    ok: true,
    value: {
      root,
      textures: collectTextureInfos(root),
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
