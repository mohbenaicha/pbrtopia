import type { Material, Mesh, Object3D } from 'three';
import type { MapAdjustUniforms } from './mapAdjustUniforms';
import { createAlbedoLook, createChannelLook, createNormalLook } from './shadingMaterials';

export type ShadingMode = 'lit' | 'albedo' | 'normal' | 'rough' | 'metal';

interface ShadingModes {
  apply(root: Object3D, mode: ShadingMode): void;
  applyMaterial(root: Object3D, material: Material): void; // one material over the whole model; apply() puts the looks back
  setFlatShading(root: Object3D, flat: boolean): void; // the lit look of each mesh shows faceted when flat, and always when the mesh has no normals
  derivedMaterialCount(): number;
  dispose(root: Object3D): void; // puts the original materials back and frees the derived ones
}

type MeshMaterial = Material | Material[];

const isModelMesh = (object: Object3D): object is Mesh => (object as Mesh).isMesh === true && object.userData['isWireframeOverlay'] !== true;

// Switches every model mesh between its own material (lit) and a flat look derived from it. A derived look is built once per source material and mode, then reused.
export function createShadingModes(adjust: MapAdjustUniforms): ShadingModes {
  const derived = new Map<Material, Map<ShadingMode, Material>>();
  const originals = new WeakMap<Mesh, MeshMaterial>();

  const build = (source: Material, mode: ShadingMode): Material => {
    if (mode === 'albedo') return createAlbedoLook(source);
    if (mode === 'normal') return createNormalLook(source);
    return createChannelLook(source, mode === 'rough' ? 'rough' : 'metal', adjust);
  };

  const lookFor = (source: Material, mode: ShadingMode): Material => {
    if (mode === 'lit') return source;
    const looks = derived.get(source) ?? new Map<ShadingMode, Material>();
    derived.set(source, looks);
    const existing = looks.get(mode);
    if (existing) return existing;
    const created = build(source, mode);
    looks.set(mode, created);
    return created;
  };

  const apply = (root: Object3D, mode: ShadingMode): void => {
    root.traverse((object) => {
      if (!isModelMesh(object)) return;
      if (!originals.has(object)) originals.set(object, object.material);
      const original = originals.get(object)!;
      object.material = Array.isArray(original) ? original.map((material) => lookFor(material, mode)) : lookFor(original, mode);
    });
  };

  const applyMaterial = (root: Object3D, material: Material): void => {
    root.traverse((object) => {
      if (!isModelMesh(object)) return;
      if (!originals.has(object)) originals.set(object, object.material);
      const original = originals.get(object)!;
      object.material = Array.isArray(original) ? original.map(() => material) : material;
    });
  };

  const setFlatShading = (root: Object3D, flat: boolean): void => {
    root.traverse((object) => {
      if (!isModelMesh(object)) return;
      const wanted = flat || !object.geometry.getAttribute('normal'); // the loader leaves a model without normals flat, as there is nothing to smooth
      const own = originals.get(object) ?? object.material;
      for (const material of Array.isArray(own) ? own : [own]) {
        const shaded = material as Material & { flatShading?: boolean };
        if (typeof shaded.flatShading !== 'boolean' || shaded.flatShading === wanted) continue;
        shaded.flatShading = wanted;
        shaded.needsUpdate = true;
      }
    });
  };

  return {
    apply,
    applyMaterial,
    setFlatShading,
    derivedMaterialCount: () => [...derived.values()].reduce((total, looks) => total + looks.size, 0),
    dispose(root) {
      apply(root, 'lit');
      derived.forEach((looks) => looks.forEach((look) => look.dispose()));
      derived.clear();
    },
  };
}
