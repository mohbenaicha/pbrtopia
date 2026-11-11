// Imageops R41, R42: ambient occlusion fragment shaders. Distances are pixels of the map at size S, sent as fractions of the image (R21); sampling wraps (R6).

const DIRECTIONS = `
const vec2 DIRECTIONS[8] = vec2[8](
  vec2(1.0, 0.0), vec2(0.70710678, 0.70710678), vec2(0.0, 1.0), vec2(-0.70710678, 0.70710678),
  vec2(-1.0, 0.0), vec2(-0.70710678, -0.70710678), vec2(0.0, -1.0), vec2(0.70710678, -0.70710678));`;

// 8 directions x 4 steps at spread * k / 4; each sample adds max(0, (h - h0) * depth) / k; ao = 1 - clamp(sum / weight * strength).
export const AO_FROM_HEIGHT_FRAGMENT = `${DIRECTIONS}
uniform sampler2D uSource;
uniform float uSpreadUv; // spread in texels of the map at size S, divided by S
uniform float uDepth;
uniform float uStrength;
varying vec2 vUv;
void main() {
  float centre = texture2D(uSource, vUv).r;
  float sum = 0.0;
  float weight = 0.0;
  for (int d = 0; d < 8; d++) {
    for (int k = 1; k <= 4; k++) {
      float fk = float(k);
      float h = texture2D(uSource, vUv + DIRECTIONS[d] * uSpreadUv * fk / 4.0).r;
      sum += max(0.0, (h - centre) * uDepth) / fk;
      weight += 1.0 / fk;
    }
  }
  float ao = 1.0 - clamp(sum / weight * uStrength, 0.0, 1.0);
  gl_FragColor = vec4(vec3(ao), 1.0);
}`;

// 8 taps at the spread: occ = mean(max(0, 1 - dot(n0, n1))); ao = pow(clamp(1 - occ + bias, 0, 1), power).
export const AO_FROM_NORMAL_FRAGMENT = `${DIRECTIONS}
uniform sampler2D uSource;
uniform float uSpreadUv;
uniform float uPower;
uniform float uBias;
varying vec2 vUv;
vec3 decode(vec2 uv) { return normalize(texture2D(uSource, uv).rgb * 2.0 - 1.0); }
void main() {
  vec3 n0 = decode(vUv);
  float occlusion = 0.0;
  for (int d = 0; d < 8; d++) occlusion += max(0.0, 1.0 - dot(n0, decode(vUv + DIRECTIONS[d] * uSpreadUv)));
  occlusion /= 8.0;
  float ao = pow(clamp(1.0 - occlusion + uBias, 0.0, 1.0), uPower);
  gl_FragColor = vec4(vec3(ao), 1.0);
}`;
