import { Matrix3, MeshBasicMaterial, ShaderMaterial, Vector3, type Color, type Material, type Texture } from 'three';
import type { MapAdjustUniforms } from './mapAdjustUniforms';

// What a model material may carry, whichever three material class the loader gave it.
type SourceMaterial = Material & {
  color?: Color;
  map?: Texture | null;
  normalMap?: Texture | null;
  roughnessMap?: Texture | null;
  metalnessMap?: Texture | null;
  roughness?: number;
  metalness?: number;
  vertexColors?: boolean;
  alphaMap?: Texture | null;
  alphaTest?: number;
};

const VERTEX_SHADER = `
uniform mat3 uUvTransform;
varying vec2 vUv;
void main() {
  vUv = (uUvTransform * vec3(uv, 1.0)).xy;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}`;

// The map value times the material factor, then strength and contrast: clamp((v * strength - 0.5) * contrast + 0.5). Written straight to the screen so the grey shown is the number stored.
const CHANNEL_FRAGMENT_SHADER = `
uniform sampler2D uMap;
uniform bool uHasMap;
uniform vec3 uChannel;
uniform float uFactor;
uniform float uStrength;
uniform float uContrast;
varying vec2 vUv;
void main() {
  float value = uFactor;
  if (uHasMap) value *= dot(texture2D(uMap, vUv).rgb, uChannel);
  value = clamp((value * uStrength - 0.5) * uContrast + 0.5, 0.0, 1.0);
  gl_FragColor = vec4(vec3(value), 1.0);
}`;

// The stored normal map as it is, or the flat normal (128, 128, 255) when the material has none.
const NORMAL_FRAGMENT_SHADER = `
uniform sampler2D uMap;
uniform bool uHasMap;
varying vec2 vUv;
void main() {
  gl_FragColor = uHasMap ? vec4(texture2D(uMap, vUv).rgb, 1.0) : vec4(128.0 / 255.0, 128.0 / 255.0, 1.0, 1.0);
}`;

function uvTransformOf(texture: Texture | null | undefined): Matrix3 {
  if (!texture) return new Matrix3();
  texture.updateMatrix();
  return texture.matrix;
}

function shaderLook(source: SourceMaterial, texture: Texture | null | undefined, fragmentShader: string, extra: ShaderMaterial['uniforms']): ShaderMaterial {
  return new ShaderMaterial({
    vertexShader: VERTEX_SHADER,
    fragmentShader,
    uniforms: { uMap: { value: texture ?? null }, uHasMap: { value: Boolean(texture) }, uUvTransform: { value: uvTransformOf(texture) }, ...extra },
    side: source.side,
    toneMapped: false,
  });
}

// Flat colour: the colour map and colour with no lighting and no tone mapping.
export function createAlbedoLook(source: SourceMaterial): MeshBasicMaterial {
  return new MeshBasicMaterial({
    map: source.map ?? null,
    ...(source.color ? { color: source.color } : {}),
    vertexColors: source.vertexColors ?? false,
    side: source.side,
    transparent: source.transparent,
    opacity: source.opacity,
    alphaMap: source.alphaMap ?? null,
    alphaTest: source.alphaTest ?? 0,
    toneMapped: false,
  });
}

export function createNormalLook(source: SourceMaterial): ShaderMaterial {
  return shaderLook(source, source.normalMap, NORMAL_FRAGMENT_SHADER, {});
}

// Roughness is the green channel of its map and metalness the blue one (glTF), each times the material's own factor.
export function createChannelLook(source: SourceMaterial, channel: 'rough' | 'metal', adjust: MapAdjustUniforms): ShaderMaterial {
  const rough = channel === 'rough';
  return shaderLook(source, rough ? source.roughnessMap : source.metalnessMap, CHANNEL_FRAGMENT_SHADER, {
    uChannel: { value: rough ? new Vector3(0, 1, 0) : new Vector3(0, 0, 1) },
    uFactor: { value: (rough ? source.roughness : source.metalness) ?? 1 },
    uStrength: rough ? adjust.roughStrength : adjust.metalStrength,
    uContrast: rough ? adjust.roughContrast : adjust.metalContrast,
  });
}
