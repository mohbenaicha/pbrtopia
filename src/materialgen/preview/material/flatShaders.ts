import { MASK_UNIFORMS, maskMixFor } from './maskShader';
import { TOOL_FRAGMENT_SUPPORT, TOOL_VERTEX_SUPPORT } from './toolShaderCode';

// Preview R51: the flat views move vertices exactly as the Shaded view does (three's displacement: along the normal by `height * scale + bias`, sampled at the tiled UV),
// so the shape never changes when the mode does. The fragment shaders draw one map unlit. Every map read goes through the transform of an open Crop or Mirror
// (R58, imageops R53), and the marker is mixed into what is drawn (imageops R56).
export const FLAT_VERTEX_SHADER = `
${TOOL_VERTEX_SUPPORT}
uniform sampler2D uHeight;
uniform bool uHasHeight;
uniform vec2 uTile;
uniform float uDisplacementScale;
uniform float uDisplacementBias;
varying vec2 vUv;
void main() {
  vUv = uv * uTile;
  vec3 displaced = position;
  if (uHasHeight) displaced += normalize(normal) * (toolTexelVertex(uHeight, vUv).x * uDisplacementScale + uDisplacementBias);
  gl_Position = projectionMatrix * modelViewMatrix * vec4(displaced, 1.0);
}`;

// The colour map (read as sRGB, so linear in the shader) or the missing-map colour, with the mask overlay (R18) when it is on, converted back for the screen.
export const FLAT_COLOR_FRAGMENT_SHADER = `
${TOOL_FRAGMENT_SUPPORT}
${MASK_UNIFORMS}
uniform sampler2D uMap;
uniform bool uHasMap;
uniform vec3 uFallbackColor;
varying vec2 vUv;
void main() {
  vec3 color = uHasMap ? toolTexel(uMap, vUv).rgb : uFallbackColor;
  ${maskMixFor('vUv', 'color')}
  color = toolMarked(color, vUv);
  gl_FragColor = vec4(color, 1.0);
  #include <colorspace_fragment>
}`;

// One channel of a map as grey, then strength and contrast: clamp((v * strength - 0.5) * contrast + 0.5). Written straight to the screen so the grey shown is the number stored.
export const FLAT_CHANNEL_FRAGMENT_SHADER = `
${TOOL_FRAGMENT_SUPPORT}
uniform sampler2D uMap;
uniform bool uHasMap;
uniform vec3 uChannel;
uniform float uFallback;
uniform float uStrength;
uniform float uContrast;
varying vec2 vUv;
void main() {
  float value = uHasMap ? dot(toolTexel(uMap, vUv).rgb, uChannel) : uFallback;
  value = clamp((value * uStrength - 0.5) * uContrast + 0.5, 0.0, 1.0);
  gl_FragColor = vec4(toolMarked(vec3(value), vUv), 1.0);
}`;

// The normal map as a vector from -1 to 1: x and y times the strength, the whole vector times the contrast, clamped, shown as a colour again (the Shaded view tilts with the same x and y).
export const FLAT_NORMAL_FRAGMENT_SHADER = `
${TOOL_FRAGMENT_SUPPORT}
uniform sampler2D uMap;
uniform bool uHasMap;
uniform float uStrength;
uniform float uContrast;
varying vec2 vUv;
void main() {
  vec3 n = (uHasMap ? toolNormalTexel(uMap, vUv).rgb : vec3(128.0 / 255.0, 128.0 / 255.0, 1.0)) * 2.0 - 1.0;
  n.xy *= uStrength;
  n = clamp(n * uContrast, -1.0, 1.0);
  gl_FragColor = vec4(toolMarked(n * 0.5 + 0.5, vUv), 1.0);
}`;
