import { BoxGeometry, Color, DataTexture, Group, Mesh, MeshBasicMaterial, MeshStandardMaterial, ShaderMaterial, type Material } from 'three';
import { describe, expect, it, vi } from 'vitest';
import { createMapAdjustUniforms, setMapAdjust } from '../../src/viewport/mapAdjustUniforms';
import { createShadingModes } from '../../src/viewport/shadingModes';
import { createWireframeOverlay } from '../../src/viewport/wireframeOverlay';

function sceneWithTwoMaterials() {
  const colourMap = new DataTexture(new Uint8Array([200, 50, 50, 255]), 1, 1);
  const shared = new MeshStandardMaterial({ map: colourMap, color: new Color(0.5, 0.6, 0.7), metalness: 0.4, roughness: 0.8 });
  const other = new MeshStandardMaterial();
  const root = new Group();
  const first = new Mesh(new BoxGeometry(), shared);
  const second = new Mesh(new BoxGeometry(), shared);
  const third = new Mesh(new BoxGeometry(), other);
  root.add(first, second, third);
  return { root, shared, other, first, second, third, colourMap };
}

const materialOf = (mesh: Mesh): Material => mesh.material as Material;

describe('shading modes', () => {
  it('R17 applying one material to the whole model replaces every look and the original materials come back with any mode', () => {
    const { root, shared, other, first, third } = sceneWithTwoMaterials();
    const modes = createShadingModes(createMapAdjustUniforms());
    const replacement = new MeshBasicMaterial();
    modes.applyMaterial(root, replacement); // before any mode was ever applied
    expect(materialOf(first)).toBe(replacement);
    expect(materialOf(third)).toBe(replacement);
    modes.apply(root, 'lit');
    expect(materialOf(first)).toBe(shared);
    expect(materialOf(third)).toBe(other);
    modes.applyMaterial(root, replacement);
    modes.apply(root, 'albedo');
    expect((materialOf(first) as MeshBasicMaterial).isMeshBasicMaterial).toBe(true);
    expect(materialOf(first)).not.toBe(replacement);
  });

  it('R17 applying one material leaves the wireframe overlay with its own material', () => {
    const { root, first } = sceneWithTwoMaterials();
    const overlay = createWireframeOverlay(root);
    overlay.setVisible(true);
    const replacement = new MeshBasicMaterial();
    createShadingModes(createMapAdjustUniforms()).applyMaterial(root, replacement);
    const overlayMesh = first.children[0] as Mesh;
    expect(overlayMesh.userData['isWireframeOverlay']).toBe(true);
    expect(overlayMesh.material).not.toBe(replacement);
  });

  it('R15 lit keeps each mesh on its own material, and the other four modes each give a different look', () => {
    const { root, shared, first } = sceneWithTwoMaterials();
    const modes = createShadingModes(createMapAdjustUniforms());
    modes.apply(root, 'lit');
    expect(materialOf(first)).toBe(shared);
    const looks = (['albedo', 'normal', 'rough', 'metal'] as const).map((mode) => {
      modes.apply(root, mode);
      return materialOf(first);
    });
    expect(new Set(looks).size).toBe(4);
    expect(looks.every((look) => look !== shared)).toBe(true);
  });

  it('R15 albedo is an unlit copy of the colour map and colour that ignores tone mapping', () => {
    const { root, first, shared, colourMap } = sceneWithTwoMaterials();
    createShadingModes(createMapAdjustUniforms()).apply(root, 'albedo');
    const look = materialOf(first) as MeshBasicMaterial;
    expect(look.isMeshBasicMaterial).toBe(true);
    expect(look.map).toBe(colourMap);
    expect(look.color.toArray()).toEqual(shared.color.toArray());
    expect(look.toneMapped).toBe(false);
  });

  it('R15 normal, rough and metal are flat shader looks that skip tone mapping', () => {
    const { root, first } = sceneWithTwoMaterials();
    const modes = createShadingModes(createMapAdjustUniforms());
    for (const mode of ['normal', 'rough', 'metal'] as const) {
      modes.apply(root, mode);
      const look = materialOf(first) as ShaderMaterial;
      expect(look.isShaderMaterial).toBe(true);
      expect(look.toneMapped).toBe(false);
    }
  });

  it('R15 switching back reuses the derived materials: nothing is built twice, meshes sharing a material share the look', () => {
    const { root, first, second, third, shared } = sceneWithTwoMaterials();
    const modes = createShadingModes(createMapAdjustUniforms());
    modes.apply(root, 'rough');
    const roughFirst = materialOf(first);
    const roughThird = materialOf(third);
    expect(materialOf(second)).toBe(roughFirst);
    expect(roughThird).not.toBe(roughFirst);
    const built = modes.derivedMaterialCount();
    expect(built).toBe(2);

    modes.apply(root, 'lit');
    expect(materialOf(first)).toBe(shared);
    modes.apply(root, 'albedo');
    modes.apply(root, 'rough');
    expect(materialOf(first)).toBe(roughFirst);
    expect(materialOf(third)).toBe(roughThird);
    expect(modes.derivedMaterialCount()).toBe(built + 2); // only the albedo pair was added
  });

  it('textures R13 refresh drops the derived looks so the next apply copies the source material as it now is', () => {
    const { root, first, shared } = sceneWithTwoMaterials();
    const modes = createShadingModes(createMapAdjustUniforms());
    modes.apply(root, 'albedo');
    const stale = materialOf(first) as MeshBasicMaterial;
    const disposeStale = vi.spyOn(stale, 'dispose');
    const picture = new DataTexture(new Uint8Array([1, 2, 3, 255]), 1, 1);
    shared.map = picture;
    modes.refresh(root);
    expect(materialOf(first)).toBe(shared); // the originals are back until the caller applies a look
    expect(modes.derivedMaterialCount()).toBe(0);
    expect(disposeStale).toHaveBeenCalledTimes(1);
    modes.apply(root, 'albedo');
    expect((materialOf(first) as MeshBasicMaterial).map).toBe(picture);
  });

  it('R15 the metal and rough sliders change uniforms on the existing materials and build none', () => {
    const { root, first } = sceneWithTwoMaterials();
    const adjust = createMapAdjustUniforms();
    const modes = createShadingModes(adjust);
    modes.apply(root, 'rough');
    const rough = materialOf(first) as ShaderMaterial;
    modes.apply(root, 'metal');
    const metal = materialOf(first) as ShaderMaterial;
    const built = modes.derivedMaterialCount();

    setMapAdjust(adjust, { roughStrength: 2, roughContrast: 1.5, metalStrength: 0.25, metalContrast: 3 });
    expect(rough.uniforms['uStrength']!.value).toBe(2);
    expect(rough.uniforms['uContrast']!.value).toBe(1.5);
    expect(metal.uniforms['uStrength']!.value).toBe(0.25);
    expect(metal.uniforms['uContrast']!.value).toBe(3);
    expect(modes.derivedMaterialCount()).toBe(built);
    expect(materialOf(first)).toBe(metal);
  });

  it('viewport-layout R14 the Normal sliders change uniforms on the existing normal look and build none', () => {
    const { root, first } = sceneWithTwoMaterials();
    const adjust = createMapAdjustUniforms();
    const modes = createShadingModes(adjust);
    modes.apply(root, 'normal');
    const normal = materialOf(first) as ShaderMaterial;
    const built = modes.derivedMaterialCount();
    setMapAdjust(adjust, { normalStrength: 2, normalContrast: 0.5 });
    expect(normal.uniforms['uStrength']!.value).toBe(2);
    expect(normal.uniforms['uContrast']!.value).toBe(0.5);
    expect(modes.derivedMaterialCount()).toBe(built);
    expect(materialOf(first)).toBe(normal);
  });

  it('R15 the factors of the original material feed the rough and metal looks', () => {
    const { root, first } = sceneWithTwoMaterials();
    const modes = createShadingModes(createMapAdjustUniforms());
    modes.apply(root, 'rough');
    expect((materialOf(first) as ShaderMaterial).uniforms['uFactor']!.value).toBeCloseTo(0.8);
    modes.apply(root, 'metal');
    expect((materialOf(first) as ShaderMaterial).uniforms['uFactor']!.value).toBeCloseTo(0.4);
  });

  it('R15 the wireframe overlay is never given a shading look', () => {
    const { root } = sceneWithTwoMaterials();
    const overlay = createWireframeOverlay(root);
    overlay.setVisible(true);
    const overlayMaterials = overlay.meshes().map(materialOf);
    createShadingModes(createMapAdjustUniforms()).apply(root, 'normal');
    expect(overlay.meshes().map(materialOf)).toEqual(overlayMaterials);
  });

  it('R15 a mesh added after a mode was chosen is brought into it when apply runs again', () => {
    const { root, shared } = sceneWithTwoMaterials();
    const modes = createShadingModes(createMapAdjustUniforms());
    modes.apply(root, 'albedo');
    const late = new Mesh(new BoxGeometry(), shared);
    root.add(late);
    modes.apply(root, 'albedo');
    expect((materialOf(late) as MeshBasicMaterial).isMeshBasicMaterial).toBe(true);
    modes.apply(root, 'lit');
    expect(materialOf(late)).toBe(shared);
  });

  it('R15 dispose frees the derived materials and leaves the original ones to the model', () => {
    const { root, shared, other } = sceneWithTwoMaterials();
    const modes = createShadingModes(createMapAdjustUniforms());
    modes.apply(root, 'albedo');
    modes.apply(root, 'rough');
    const originalDispose = [vi.spyOn(shared, 'dispose'), vi.spyOn(other, 'dispose')];
    const derived = [] as Material[];
    root.traverse((object) => {
      if ((object as Mesh).isMesh) derived.push(materialOf(object as Mesh));
    });
    const derivedDispose = derived.map((material) => vi.spyOn(material, 'dispose'));
    modes.dispose(root);
    expect(derivedDispose.every((spy) => spy.mock.calls.length >= 1)).toBe(true);
    expect(originalDispose.every((spy) => spy.mock.calls.length === 0)).toBe(true);
    expect(modes.derivedMaterialCount()).toBe(0);
  });
});
