import { ShaderChunk, type Material, type Mesh, type Object3D, type WebGLProgramParametersWithUniforms, type WebGLRenderer } from 'three';
import type { MapAdjustUniforms } from './mapAdjustUniforms';
import { MAP_ADJUST_KEYS, type MapAdjustKey } from './viewportSettings';

type BeforeCompile = (shader: WebGLProgramParametersWithUniforms, renderer: WebGLRenderer) => void;
type LitMaterial = Material & { isMeshStandardMaterial: true; onBeforeCompile: BeforeCompile; customProgramCacheKey(): string };

const CACHE_KEY_SUFFIX = 'lit-look-adjust';

// The same arithmetic as the flat Rough and Metal views: clamp((value * strength - 0.5) * contrast + 0.5); at strength 1 and contrast 1 it returns the value.
const ADJUST = (factor: string, strength: string, contrast: string): string => `
  ${factor} = clamp((${factor} * ${strength} - 0.5) * ${contrast} + 0.5, 0.0, 1.0);`;

// The shader uniform of a slider: roughStrength is uRoughStrength.
const uniformNameOf = (key: MapAdjustKey): string => `u${key.charAt(0).toUpperCase()}${key.slice(1)}`;

const UNIFORM_DECLARATIONS = MAP_ADJUST_KEYS.map((key) => `uniform float ${uniformNameOf(key)};\n`).join('');

// The normal map is read as a tangent-space vector and tilted by the same x and y as the flat Normal view shows (strength, then contrast, clamped to -1..1), before it lights the surface.
const NORMAL_TILT = `mapN.xy *= normalScale;
	mapN.xy = clamp(mapN.xy * uNormalStrength * uNormalContrast, -1.0, 1.0);`;
const TILTED_NORMAL_CHUNK = ShaderChunk.normal_fragment_maps.replace('mapN.xy *= normalScale;', NORMAL_TILT);

const isLitMaterial = (material: Material): material is LitMaterial => (material as Partial<LitMaterial>).isMeshStandardMaterial === true;

const materialsOf = (root: Object3D): Set<LitMaterial> => {
  const found = new Set<LitMaterial>();
  root.traverse((object) => {
    const mesh = object as Mesh;
    if (mesh.isMesh !== true || object.userData['isWireframeOverlay'] === true) return;
    for (const material of Array.isArray(mesh.material) ? mesh.material : [mesh.material]) if (isLitMaterial(material)) found.add(material);
  });
  return found;
};

interface LitLook {
  attach(root: Object3D): void; // the Metal, Roughness and Normal sliders now reach the shaded look of the model's own materials
  detach(root: Object3D): void; // the materials are as the file defines them again
}

/**
 * Lets the shared Metal, Roughness and Normal uniforms act on the shaded view (viewport-layout R14): each standard material gets a shader patch that
 * adjusts the roughness and metalness it has just computed (map value times factor) and tilts the normal it has just read, before the lighting. The material's stored
 * factors and maps are never changed, so nothing exported, baked or captured sees the sliders.
 */
export function createLitLook(adjust: MapAdjustUniforms): LitLook {
  const previous = new Map<LitMaterial, { hook: BeforeCompile; cacheKey: () => string }>();

  return {
    attach(root) {
      for (const material of materialsOf(root)) {
        if (previous.has(material)) continue;
        const hook = material.onBeforeCompile;
        const cacheKey = material.customProgramCacheKey;
        previous.set(material, { hook, cacheKey });
        material.onBeforeCompile = (shader, renderer) => {
          hook.call(material, shader, renderer);
          for (const key of MAP_ADJUST_KEYS) shader.uniforms[uniformNameOf(key)] = adjust[key];
          const adjusted = shader.fragmentShader
            .replace('#include <roughnessmap_fragment>', `#include <roughnessmap_fragment>${ADJUST('roughnessFactor', 'uRoughStrength', 'uRoughContrast')}`)
            .replace('#include <metalnessmap_fragment>', `#include <metalnessmap_fragment>${ADJUST('metalnessFactor', 'uMetalStrength', 'uMetalContrast')}`)
            .replace('#include <normal_fragment_maps>', TILTED_NORMAL_CHUNK);
          if (adjusted !== shader.fragmentShader) shader.fragmentShader = UNIFORM_DECLARATIONS + adjusted;
        };
        material.customProgramCacheKey = () => `${cacheKey.call(material)}|${CACHE_KEY_SUFFIX}`;
        material.needsUpdate = true;
      }
    },
    detach(root) {
      for (const material of materialsOf(root)) {
        const saved = previous.get(material);
        if (!saved) continue;
        material.onBeforeCompile = saved.hook;
        material.customProgramCacheKey = saved.cacheKey;
        material.needsUpdate = true;
        previous.delete(material);
      }
    },
  };
}
