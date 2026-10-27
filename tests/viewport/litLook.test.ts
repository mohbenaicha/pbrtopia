import { Group, Mesh, MeshBasicMaterial, MeshPhysicalMaterial, MeshStandardMaterial, BoxGeometry, type WebGLProgramParametersWithUniforms } from 'three';
import { describe, expect, it, vi } from 'vitest';
import { createMapAdjustUniforms } from '../../src/viewport/mapAdjustUniforms';
import { createLitLook } from '../../src/viewport/litLook';

const FRAGMENT = `
void main() {
  #include <roughnessmap_fragment>
  #include <metalnessmap_fragment>
  #include <normal_fragment_maps>
}`;

const compile = (material: MeshStandardMaterial) => {
  const shader = { uniforms: {} as Record<string, unknown>, fragmentShader: FRAGMENT } as unknown as WebGLProgramParametersWithUniforms;
  material.onBeforeCompile(shader, undefined as never);
  return shader as unknown as { uniforms: Record<string, unknown>; fragmentShader: string };
};

const modelWith = (...materials: (MeshStandardMaterial | MeshBasicMaterial)[]): Group => {
  const root = new Group();
  for (const material of materials) root.add(new Mesh(new BoxGeometry(1, 1, 1), material));
  return root;
};

describe('lit look', () => {
  it('viewport-layout R14 the lit material reads the same strength and contrast uniforms as the flat looks, applied to the roughness and metalness it computed', () => {
    const adjust = createMapAdjustUniforms();
    const material = new MeshStandardMaterial();
    createLitLook(adjust).attach(modelWith(material));
    const shader = compile(material);
    expect(shader.uniforms['uRoughStrength']).toBe(adjust.roughStrength);
    expect(shader.uniforms['uRoughContrast']).toBe(adjust.roughContrast);
    expect(shader.uniforms['uMetalStrength']).toBe(adjust.metalStrength);
    expect(shader.uniforms['uMetalContrast']).toBe(adjust.metalContrast);
    const roughAt = shader.fragmentShader.indexOf('roughnessFactor = clamp(');
    const metalAt = shader.fragmentShader.indexOf('metalnessFactor = clamp(');
    expect(roughAt).toBeGreaterThan(shader.fragmentShader.indexOf('#include <roughnessmap_fragment>'));
    expect(metalAt).toBeGreaterThan(shader.fragmentShader.indexOf('#include <metalnessmap_fragment>'));
  });

  it('viewport-layout R14 the lit material tilts the normal it read from the map by the Normal strength and contrast, with the same shared uniforms', () => {
    const adjust = createMapAdjustUniforms();
    const material = new MeshStandardMaterial();
    createLitLook(adjust).attach(modelWith(material));
    const shader = compile(material);
    expect(shader.uniforms['uNormalStrength']).toBe(adjust.normalStrength);
    expect(shader.uniforms['uNormalContrast']).toBe(adjust.normalContrast);
    expect(shader.fragmentShader).toContain('uniform float uNormalStrength;');
    expect(shader.fragmentShader).toContain('uniform float uNormalContrast;');
    const tilt = shader.fragmentShader.indexOf('mapN.xy = clamp(mapN.xy * uNormalStrength * uNormalContrast');
    expect(tilt).toBeGreaterThan(shader.fragmentShader.indexOf('mapN.xy *= normalScale;')); // after three has read the map, before it lights with it
    expect(tilt).toBeLessThan(shader.fragmentShader.indexOf('normal = normalize( tbn * mapN )'));
    expect(shader.fragmentShader).not.toContain('#include <normal_fragment_maps>');
  });

  it('viewport-layout R14 moving a slider changes the value the shader reads, and nothing is rebuilt', () => {
    const adjust = createMapAdjustUniforms();
    const material = new MeshStandardMaterial();
    createLitLook(adjust).attach(modelWith(material));
    const shader = compile(material);
    adjust.roughStrength.value = 0.4;
    expect((shader.uniforms['uRoughStrength'] as { value: number }).value).toBe(0.4);
  });

  it('viewport-layout R14 physical materials and lists of materials are patched too; other materials are left alone', () => {
    const physical = new MeshPhysicalMaterial();
    const first = new MeshStandardMaterial();
    const second = new MeshStandardMaterial();
    const basic = new MeshBasicMaterial();
    const root = modelWith(physical, basic);
    root.add(new Mesh(new BoxGeometry(1, 1, 1), [first, second]));
    createLitLook(createMapAdjustUniforms()).attach(root);
    for (const material of [physical, first, second]) expect(compile(material).fragmentShader).toContain('roughnessFactor = clamp(');
    expect(basic.onBeforeCompile).toBe(new MeshBasicMaterial().onBeforeCompile);
  });

  it('viewport-layout R14 a shader that has no roughness or metalness chunk is passed on unchanged', () => {
    const material = new MeshStandardMaterial();
    createLitLook(createMapAdjustUniforms()).attach(modelWith(material));
    const shader = { uniforms: {}, fragmentShader: 'void main() {}' } as unknown as WebGLProgramParametersWithUniforms;
    material.onBeforeCompile(shader, undefined as never);
    expect(shader.fragmentShader).toBe('void main() {}');
  });

  it('viewport-layout R14 the material is recompiled once when patched, and the program is told apart from an unpatched one', () => {
    const material = new MeshStandardMaterial();
    const version = material.version;
    createLitLook(createMapAdjustUniforms()).attach(modelWith(material));
    expect(material.version).toBeGreaterThan(version);
    expect(material.customProgramCacheKey()).not.toBe(new MeshStandardMaterial().customProgramCacheKey());
  });

  it('viewport-layout R14 attaching twice patches once, and the original hook of the material still runs', () => {
    const own = vi.fn();
    const material = new MeshStandardMaterial();
    material.onBeforeCompile = own;
    const look = createLitLook(createMapAdjustUniforms());
    const root = modelWith(material);
    look.attach(root);
    look.attach(root);
    const shader = compile(material);
    expect(own).toHaveBeenCalledTimes(1);
    expect(shader.fragmentShader.match(/roughnessFactor = clamp\(/g)).toHaveLength(1);
  });

  it('viewport-layout R14 detach puts the material back as it was and recompiles it', () => {
    const own = vi.fn();
    const material = new MeshStandardMaterial();
    material.onBeforeCompile = own;
    const look = createLitLook(createMapAdjustUniforms());
    const root = modelWith(material);
    look.attach(root);
    const version = material.version;
    look.detach(root);
    expect(material.onBeforeCompile).toBe(own);
    expect(material.version).toBeGreaterThan(version);
    const untouched = new MeshStandardMaterial();
    untouched.onBeforeCompile = own;
    expect(material.customProgramCacheKey()).toBe(untouched.customProgramCacheKey());
  });

  it('viewport-layout R14 the stored material factors and maps are not touched, so exports and bakes never see the sliders', () => {
    const material = new MeshStandardMaterial({ roughness: 0.7, metalness: 0.2 });
    const look = createLitLook(createMapAdjustUniforms({ metalStrength: 3, metalContrast: 3, roughStrength: 0, roughContrast: 0, normalStrength: 0, normalContrast: 0 }));
    look.attach(modelWith(material));
    expect(material.roughness).toBe(0.7);
    expect(material.metalness).toBe(0.2);
  });
});
