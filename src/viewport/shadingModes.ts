import type { Material, Mesh, Object3D } from 'three';
import type { MapAdjustUniforms } from './mapAdjustUniforms';
import { createAlbedoLook, createChannelLook, createNormalLook } from './shadingMaterials';

export type ShadingMode = 'lit' | 'albedo' | 'normal' | 'rough' | 'metal';

export interface ShadingModes {
  apply(root: Object3D, mode: ShadingMode): void;
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

  return {
    apply,
    derivedMaterialCount: () => [...derived.values()].reduce((total, looks) => total + looks.size, 0),
    dispose(root) {
      apply(root, 'lit');
      derived.forEach((looks) => looks.forEach((look) => look.dispose()));
      derived.clear();
    },
  };
}
