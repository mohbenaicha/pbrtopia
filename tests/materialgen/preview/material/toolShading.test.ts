import { Group, Mesh, MeshPhysicalMaterial, PlaneGeometry, type WebGLProgramParametersWithUniforms } from 'three';
import { describe, expect, it } from 'vitest';
import { SEAM_GLSL } from '@mat/imageops';
import { createLitLook, createMapAdjustUniforms } from '@shared/viewport';
import { createFlatLooks } from '../../../../src/materialgen/preview/material/createFlatLooks';
import { createMaskOverlay } from '../../../../src/materialgen/preview/material/createMaskOverlay';
import { createToolShading } from '../../../../src/materialgen/preview/material/createToolShading';
import { FLAT_CHANNEL_FRAGMENT_SHADER, FLAT_COLOR_FRAGMENT_SHADER, FLAT_NORMAL_FRAGMENT_SHADER, FLAT_VERTEX_SHADER } from '../../../../src/materialgen/preview/material/flatShaders';
import { MASK_UNIFORMS, maskMixFor } from '../../../../src/materialgen/preview/material/maskShader';
import { toolUniformValues, type ToolTransform } from '../../../../src/materialgen/preview/material/toolTransform';
import { FLAT_VIEWS } from '../../../../src/materialgen/preview/math/flatViews';

const IDENTITY_QUADRANT = (from: 0 | 1 | 2 | 3) => ({ from, flipX: false, flipY: false });
const CROP: ToolTransform = { kind: 'crop', rect: { x: 0.03125, y: 0.015625, width: 0.9375, height: 0.96875 }, edge: 'left' };
const PAIR_TOP: ToolTransform = {
  kind: 'mirror',
  plan: [IDENTITY_QUADRANT(0), IDENTITY_QUADRANT(1), { from: 0, flipX: false, flipY: true }, { from: 1, flipX: false, flipY: true }],
  marked: [true, true, false, false],
};

describe('materialgen/preview R58 the tool view as uniform values', () => {
  it('imageops R54 a crop is mode 1 with its rectangle in fractions, and R55 the marked edge as a code', () => {
    const values = toolUniformValues(CROP);
    expect(values.mode).toBe(1);
    expect(values.rect).toEqual([0.03125, 0.015625, 0.9375, 0.96875]);
    expect(values.marks[0]).toBe(2); // none 0, top 1, left 2, right 3, bottom 4
    for (const [edge, code] of [['top', 1], ['right', 3], ['bottom', 4]] as const) expect(toolUniformValues({ ...CROP, edge }).marks[0]).toBe(code);
  });

  it('imageops R55 the far corner of the result reads the far corner of the rectangle', () => {
    const { rect } = toolUniformValues(CROP);
    expect([rect[0] + rect[2], rect[1] + rect[3]]).toEqual([0.96875, 0.984375]);
  });

  it('imageops R58 no tool, and a whole picture with no edge marked, are mode 0 so the shaders skip the transform', () => {
    expect(toolUniformValues(null).mode).toBe(0);
    expect(toolUniformValues({ kind: 'crop', rect: { x: 0, y: 0, width: 1, height: 1 }, edge: null }).mode).toBe(0);
    expect(toolUniformValues({ kind: 'crop', rect: { x: 0, y: 0, width: 1, height: 1 }, edge: 'top' }).mode).toBe(1); // the marker still needs the shader
  });

  it('imageops R54 a mirror is mode 2 with, per result quadrant, the source quadrant and the two flips', () => {
    const values = toolUniformValues(PAIR_TOP);
    expect(values.mode).toBe(2);
    expect(values.plan).toEqual([0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 1, 0, 1, 0, 1, 0]);
  });

  it('imageops R56 the selected quadrants are the marks, in the order TL TR BL BR', () => {
    expect(toolUniformValues(PAIR_TOP).marks).toEqual([1, 1, 0, 0]);
  });

  it('imageops R56 a mirror with no plan shows each quadrant as it is and still marks the selection', () => {
    const values = toolUniformValues({ kind: 'mirror', plan: null, marked: [false, false, true, false] });
    expect(values.mode).toBe(2);
    expect(values.plan).toEqual([0, 0, 0, 0, 1, 0, 0, 0, 2, 0, 0, 0, 3, 0, 0, 0]);
    expect(values.marks).toEqual([0, 0, 1, 0]);
  });
});

describe('materialgen/preview R58 the shared uniforms', () => {
  it('imageops R58 setting a transform writes the same uniform objects, allocating none', () => {
    const shading = createToolShading();
    const before = { ...shading.uniforms };
    const rect = shading.uniforms.uToolRect.value;
    const plan = shading.uniforms.uToolPlan.value;
    shading.set(CROP);
    expect(shading.uniforms.uToolMode.value).toBe(1);
    expect(shading.uniforms.uToolRect.value.toArray()).toEqual([0.03125, 0.015625, 0.9375, 0.96875]);
    shading.set(PAIR_TOP);
    expect(shading.uniforms.uToolMode.value).toBe(2);
    expect(shading.uniforms.uToolPlan.value[2]!.toArray()).toEqual([0, 0, 1, 0]);
    shading.set(null);
    expect(shading.uniforms.uToolMode.value).toBe(0);
    for (const key of Object.keys(before) as Array<keyof typeof before>) expect(shading.uniforms[key]).toBe(before[key]);
    expect(shading.uniforms.uToolRect.value).toBe(rect);
    expect(shading.uniforms.uToolPlan.value).toBe(plan);
  });

  it('imageops R53 the flat views read the very uniforms the Shaded material reads', () => {
    const shading = createToolShading();
    const looks = createFlatLooks(createMapAdjustUniforms(), createMaskOverlay().uniforms, shading.uniforms);
    for (const view of FLAT_VIEWS) {
      const uniforms = looks.materialFor(view).uniforms;
      for (const key of ['uToolMode', 'uToolRect', 'uToolPlan', 'uToolMarks'] as const) expect(uniforms[key]).toBe(shading.uniforms[key]);
    }
  });
});

const COMPILED_FRAGMENT = ['#include <map_fragment>', '#include <color_fragment>', '#include <roughnessmap_fragment>', '#include <metalnessmap_fragment>', '#include <aomap_fragment>', '#include <normal_fragment_maps>', 'void main() {}'].join('\n');
const COMPILED_VERTEX = '#include <uv_vertex>\n#include <displacementmap_vertex>\nvoid main() {}';
const compile = (material: MeshPhysicalMaterial): WebGLProgramParametersWithUniforms => {
  const shader = { uniforms: {}, vertexShader: COMPILED_VERTEX, fragmentShader: COMPILED_FRAGMENT } as unknown as WebGLProgramParametersWithUniforms;
  material.onBeforeCompile(shader, null as never);
  return shader;
};

describe('materialgen/preview R53 the Shaded material', () => {
  it('imageops R53 every sample of the six maps goes through the transform, and none is left plain', () => {
    const material = new MeshPhysicalMaterial();
    createToolShading().patchLitMaterial(material);
    const { fragmentShader } = compile(material);
    for (const call of ['toolTexel( map, vMapUv )', 'toolTexel( roughnessMap, vRoughnessMapUv )', 'toolTexel( metalnessMap, vMetalnessMapUv )', 'toolTexel( aoMap, vAoMapUv )', 'toolNormalTexel( normalMap, vNormalMapUv )']) expect(fragmentShader).toContain(call);
    expect(fragmentShader).not.toMatch(/texture2D\(\s*(map|roughnessMap|metalnessMap|aoMap|normalMap)\b/);
  });

  it('imageops R53 the vertex displacement is read through the transform too', () => {
    const material = new MeshPhysicalMaterial();
    createToolShading().patchLitMaterial(material);
    const { vertexShader } = compile(material);
    expect(vertexShader).toContain('toolTexelVertex( displacementMap, vDisplacementMapUv )');
    expect(vertexShader).not.toMatch(/texture2D\(\s*displacementMap\b/);
  });

  it('imageops R56 the marker is mixed into the albedo before the lighting reads it, and uses a coordinate of its own', () => {
    const material = new MeshPhysicalMaterial();
    createToolShading().patchLitMaterial(material);
    const shader = compile(material);
    expect(shader.fragmentShader.indexOf('toolMarked(diffuseColor.rgb, vToolUv)')).toBeGreaterThan(shader.fragmentShader.indexOf('toolTexel( map, vMapUv )'));
    expect(shader.fragmentShader.indexOf('toolMarked(diffuseColor.rgb, vToolUv)')).toBeLessThan(shader.fragmentShader.indexOf('toolTexel( roughnessMap'));
    expect(shader.vertexShader).toContain('vToolUv = uv * uToolTile;');
  });

  it('imageops R53 the shader gets the shared uniforms and a program key of its own', () => {
    const shading = createToolShading();
    const material = new MeshPhysicalMaterial();
    const before = material.customProgramCacheKey();
    shading.patchLitMaterial(material);
    const shader = compile(material);
    expect(shader.uniforms['uToolMode']).toBe(shading.uniforms.uToolMode);
    expect(shader.uniforms['uToolTile']).toBe(shading.uniforms.uToolTile);
    expect(material.customProgramCacheKey()).not.toBe(before);
  });

  it('imageops R53 patched after the look, it still sees the look\'s own changes (normal tilt, roughness adjust) and wraps them', () => {
    const material = new MeshPhysicalMaterial();
    const group = new Group();
    group.add(new Mesh(new PlaneGeometry(), material));
    createLitLook(createMapAdjustUniforms()).attach(group);
    createToolShading().patchLitMaterial(material); // the order the scene uses
    const { fragmentShader } = compile(material);
    expect(fragmentShader).toContain('uNormalStrength'); // the look's tilt is there
    expect(fragmentShader).toContain('uRoughStrength');
    expect(fragmentShader).toContain('toolNormalTexel( normalMap, vNormalMapUv )'); // and the tilt's own normal read goes through the transform
    expect(fragmentShader).not.toMatch(/texture2D\(\s*normalMap\b/);
  });
});

describe('materialgen/preview R57 R60 every map is read by UV: no position-based read in any shader', () => {
  it('R57 the tiling uniform is shared by the Shaded material and every flat view, and there is no position-based repeat uniform', () => {
    const shading = createToolShading();
    expect(shading.uniforms).not.toHaveProperty('uTriplanar');
    expect(shading).not.toHaveProperty('setTriplanar');
    const looks = createFlatLooks(createMapAdjustUniforms(), createMaskOverlay().uniforms, shading.uniforms);
    for (const view of FLAT_VIEWS) {
      expect(looks.materialFor(view).uniforms['uToolTile']).toBe(shading.uniforms.uToolTile);
      expect(looks.materialFor(view).uniforms).not.toHaveProperty('uTriplanar');
    }
  });

  it('R57 the Shaded shaders carry no model position, smooth normal or axis varyings, and the displacement is read at the UV', () => {
    const material = new MeshPhysicalMaterial();
    createToolShading().patchLitMaterial(material);
    const { vertexShader, fragmentShader } = compile(material);
    for (const code of [vertexShader, fragmentShader]) expect(code).not.toMatch(/[Tt]ri[A-Z]|uTriplanar|TOOL_LIT/);
    expect(vertexShader).toContain('toolTexelVertex( displacementMap, vDisplacementMapUv )');
    expect(vertexShader.match(/uniform vec2 uToolTile;/g)).toHaveLength(1);
    expect(fragmentShader).toContain('normal = normalize( tbn * mapN );'); // the UV frame, unchanged
  });

  it('R57 the flat shaders carry no position-based read either', () => {
    for (const code of [FLAT_VERTEX_SHADER, FLAT_COLOR_FRAGMENT_SHADER, FLAT_CHANNEL_FRAGMENT_SHADER, FLAT_NORMAL_FRAGMENT_SHADER]) expect(code).not.toMatch(/[Tt]ri[A-Z]|uTriplanar|TOOL_LIT/);
    for (const code of [FLAT_COLOR_FRAGMENT_SHADER, FLAT_CHANNEL_FRAGMENT_SHADER, FLAT_NORMAL_FRAGMENT_SHADER]) expect(code.match(/uniform vec2 uToolTile;/g)).toHaveLength(1);
  });

  it('R60 the green flip is one uniform, written in place and shared by the Shaded material and every flat view', () => {
    const shading = createToolShading();
    const uniform = shading.uniforms.uNormalFlipY;
    expect(uniform.value).toBe(0);
    shading.setNormalFlipY(true);
    expect(shading.uniforms.uNormalFlipY).toBe(uniform);
    expect(uniform.value).toBe(1);
    shading.setNormalFlipY(false);
    expect(uniform.value).toBe(0);
    const looks = createFlatLooks(createMapAdjustUniforms(), createMaskOverlay().uniforms, shading.uniforms);
    for (const view of FLAT_VIEWS) expect(looks.materialFor(view).uniforms['uNormalFlipY']).toBe(uniform);
  });

  it('R60 the green is turned (g = 1 - g) in the one normal read, and the uniform is declared once in each shader', () => {
    const material = new MeshPhysicalMaterial();
    createToolShading().patchLitMaterial(material);
    const { fragmentShader, vertexShader } = compile(material);
    expect(fragmentShader.match(/uniform float uNormalFlipY;/g)).toHaveLength(1);
    expect(vertexShader).not.toContain('uNormalFlipY');
    expect(fragmentShader.match(/if \(uNormalFlipY > 0\.5\) c\.g = 1\.0 - c\.g;/g)).toHaveLength(1); // toolNormalTexel
    for (const code of [FLAT_COLOR_FRAGMENT_SHADER, FLAT_CHANNEL_FRAGMENT_SHADER, FLAT_NORMAL_FRAGMENT_SHADER]) expect(code.match(/uniform float uNormalFlipY;/g)).toHaveLength(1);
  });

  it('R57 R18 the label map is read by the UV, one fetch, never blended', () => {
    const labels = maskMixFor('vUv', 'color');
    expect(labels).toContain('texture2D(uMaskLabels, vUv).r');
    expect(MASK_UNIFORMS).not.toMatch(/maskLabelTexel|triDominantTexel|uTriplanar/);
  });
});

describe('materialgen/preview R51 R53 the flat views', () => {
  it('imageops R53 every flat shader reads its map through the transform and marks the result', () => {
    expect(FLAT_VERTEX_SHADER).toContain('toolTexelVertex(uHeight, vUv)');
    expect(FLAT_COLOR_FRAGMENT_SHADER).toContain('toolTexel(uMap, vUv)');
    expect(FLAT_CHANNEL_FRAGMENT_SHADER).toContain('toolTexel(uMap, vUv)');
    expect(FLAT_NORMAL_FRAGMENT_SHADER).toContain('toolNormalTexel(uMap, vUv)');
    for (const code of [FLAT_COLOR_FRAGMENT_SHADER, FLAT_CHANNEL_FRAGMENT_SHADER, FLAT_NORMAL_FRAGMENT_SHADER]) {
      expect(code).toContain('toolMarked(');
      expect(code).not.toContain('texture2D(uMap');
    }
    expect(FLAT_VERTEX_SHADER).not.toContain('texture2D(uHeight');
  });
});

describe('materialgen/preview R67 the Blend edges tool view', () => {
  const SEAM: ToolTransform = { kind: 'seam', depth: 0.225, profile: null };

  it('imageops R67 Blend edges is mode 3, the depth and the Canny flag ride in the rectangle uniform, and no mark is drawn', () => {
    expect(toolUniformValues(SEAM)).toMatchObject({ mode: 3, rect: [0.225, 0, 0, 0], marks: [0, 0, 0, 0] });
    expect(toolUniformValues({ kind: 'seam', depth: 0.1, profile: new Float32Array(4) }).rect).toEqual([0.1, 0, 1, 0]);
  });

  it('imageops R67 the profile texture exists only while a Canny profile is shown, is rebuilt in place for a new profile of the same size, and is freed after', () => {
    const shading = createToolShading();
    const dummy = shading.uniforms.uToolProfile.value;
    expect(dummy.image.height).toBe(2);
    shading.set({ kind: 'seam', depth: 0.2, profile: new Float32Array([0.1, 0.2, 0.3, 0.4]) });
    const shown = shading.uniforms.uToolProfile.value;
    expect([shown.image.width, shown.image.height]).toEqual([2, 2]);
    shading.set({ kind: 'seam', depth: 0.1, profile: new Float32Array([0.5, 0.6, 0.7, 0.8]) });
    expect(shading.uniforms.uToolProfile.value).toBe(shown);
    expect(Array.from(shown.image.data as unknown as Float32Array)).toEqual([0.5, 0.6, 0.7, 0.8].map((value) => Math.fround(value)));
    shading.set(null);
    expect(shading.uniforms.uToolProfile.value).toBe(dummy);
  });

  it('imageops R67 R76 the fragment shader carries the shared blend and the vertex shader does not blend', () => {
    const material = new MeshPhysicalMaterial();
    createToolShading().patchLitMaterial(material);
    const { fragmentShader, vertexShader } = compile(material);
    expect(fragmentShader).toContain(SEAM_GLSL);
    expect(vertexShader).not.toContain('seamBlend');
    expect(vertexShader).toMatch(/uToolMode == 3\) return texture2D\(s, uv\)/);
    expect(vertexShader).not.toContain('dFdx');
  });

  it('imageops R67 the flat views read the profile uniform the Shaded material reads, and the mark ignores mode 3', () => {
    const shading = createToolShading();
    const looks = createFlatLooks(createMapAdjustUniforms(), createMaskOverlay().uniforms, shading.uniforms);
    for (const view of FLAT_VIEWS) expect(looks.materialFor(view).uniforms.uToolProfile).toBe(shading.uniforms.uToolProfile);
    expect(FLAT_COLOR_FRAGMENT_SHADER).toContain(SEAM_GLSL);
    expect(FLAT_COLOR_FRAGMENT_SHADER).toMatch(/float toolMark\(vec2 uv\) \{\s*if \(uToolMode == 0 \|\| uToolMode == 3\) return 0\.0;/);
  });
});
