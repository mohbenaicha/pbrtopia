import { ShaderChunk, Vector2, Vector4, type IUniform, type Material, type WebGLProgramParametersWithUniforms, type WebGLRenderer } from 'three';
import { TOOL_FRAGMENT_SUPPORT, TOOL_VERTEX_SUPPORT } from './toolShaderCode';
import { toolUniformValues, type ToolTransform } from './toolTransform';

export interface ToolUniforms {
  uToolMode: IUniform<number>;
  uToolRect: IUniform<Vector4>;
  uToolPlan: IUniform<Vector4[]>;
  uToolMarks: IUniform<Vector4>;
  uToolTile: IUniform<Vector2>; // the tiling, for the marker of the Shaded view
  uNormalFlipY: IUniform<number>; // preview R60: 1 turns the green of every normal-map read (a DirectX map); 0 leaves it
}

export interface ToolShading {
  readonly uniforms: ToolUniforms; // shared by the shaded material and the six flat views
  set(transform: ToolTransform | null): void; // a few uniform writes; nothing is allocated (imageops R58)
  setTile(x: number, y: number): void;
  setNormalFlipY(flip: boolean): void; // R60: read the normal map as DirectX (green turned) in the Shaded and the flat Normal views
  patchLitMaterial(material: Material): void; // puts the transform on every map sample of the shaded material; apply it after the look's own patch
}

const CACHE_KEY_SUFFIX = 'tool-view';
const VERTEX_DECLARATIONS = 'varying vec2 vToolUv;\n';
const FRAGMENT_DECLARATIONS = 'varying vec2 vToolUv;\n';
const VERTEX_STATEMENTS = '\n  vToolUv = uv * uToolTile;';
const MARKER = '\n  diffuseColor.rgb = toolMarked(diffuseColor.rgb, vToolUv);\n';
const FRAGMENT_CHUNKS = ['map_fragment', 'roughnessmap_fragment', 'metalnessmap_fragment', 'aomap_fragment', 'normal_fragment_maps'];

// The patch hook receives the shader with its `#include`s unresolved, so the chunks that read a map are written out here and their reads replaced.
const inlineChunk = (source: string, chunk: string): string => source.replace(`#include <${chunk}>`, () => (ShaderChunk as unknown as Record<string, string>)[chunk]!);

/**
 * Imageops R53, R54, R56, preview R58: the uniforms of an open Crop or Mirror and the patch that makes the shaded material read through them. The flat views use the
 * same uniforms, so every view agrees.
 */
export function createToolShading(): ToolShading {
  const uniforms: ToolUniforms = {
    uToolMode: { value: 0 },
    uToolRect: { value: new Vector4(0, 0, 1, 1) },
    uToolPlan: { value: [new Vector4(), new Vector4(), new Vector4(), new Vector4()] },
    uToolMarks: { value: new Vector4() },
    uToolTile: { value: new Vector2(1, 1) },
    uNormalFlipY: { value: 0 },
  };

  return {
    uniforms,
    set(transform) {
      const values = toolUniformValues(transform);
      uniforms.uToolMode.value = values.mode;
      uniforms.uToolRect.value.set(...values.rect);
      uniforms.uToolPlan.value.forEach((quadrant, index) => quadrant.fromArray(values.plan, index * 4));
      uniforms.uToolMarks.value.set(...values.marks);
    },
    setTile(x, y) {
      uniforms.uToolTile.value.set(x, y);
    },
    setNormalFlipY(flip) {
      uniforms.uNormalFlipY.value = flip ? 1 : 0;
    },
    patchLitMaterial(material) {
      const lit = material as Material & { onBeforeCompile: (shader: WebGLProgramParametersWithUniforms, renderer: WebGLRenderer) => void; customProgramCacheKey(): string };
      const previous = lit.onBeforeCompile;
      const previousKey = lit.customProgramCacheKey;
      lit.onBeforeCompile = (shader, renderer) => {
        previous.call(lit, shader, renderer);
        Object.assign(shader.uniforms, uniforms);
        let fragment = shader.fragmentShader.replace('#include <roughnessmap_fragment>', () => `${MARKER}#include <roughnessmap_fragment>`);
        for (const chunk of FRAGMENT_CHUNKS) fragment = inlineChunk(fragment, chunk);
        fragment = fragment
          .replace(/texture2D\(\s*(map|roughnessMap|metalnessMap|aoMap)\s*,\s*(\w+)\s*\)/g, 'toolTexel( $1, $2 )')
          .replace(/texture2D\(\s*normalMap\s*,\s*(\w+)\s*\)/g, 'toolNormalTexel( normalMap, $1 )');
        const vertex = inlineChunk(shader.vertexShader.replace('#include <uv_vertex>', () => `#include <uv_vertex>${VERTEX_STATEMENTS}`), 'displacementmap_vertex').replace(
          /texture2D\(\s*displacementMap\s*,\s*(\w+)\s*\)/g,
          'toolTexelVertex( displacementMap, $1 )',
        );
        shader.fragmentShader = FRAGMENT_DECLARATIONS + TOOL_FRAGMENT_SUPPORT + fragment;
        shader.vertexShader = VERTEX_DECLARATIONS + TOOL_VERTEX_SUPPORT + vertex;
      };
      lit.customProgramCacheKey = () => `${previousKey.call(lit)}|${CACHE_KEY_SUFFIX}`;
      lit.needsUpdate = true;
    },
  };
}
