// Imageops R24-R40: the fragment shaders of the geometry ops. Texel (x, y) is row y of the pixel array (v = (y + 0.5) / size).

const SRGB_ENCODE = `
vec3 encodeSrgb(vec3 c) {
  c = clamp(c, 0.0, 1.0);
  return mix(c * 12.92, 1.055 * pow(c, vec3(1.0 / 2.4)) - 0.055, step(0.0031308, c));
}
vec3 renormalise(vec3 rgb) {
  vec3 n = rgb * 2.0 - 1.0;
  n.z = max(n.z, 0.0);
  float len = length(n);
  return len > 1e-5 ? n / len * 0.5 + 0.5 : vec3(0.5, 0.5, 1.0);
}`;

// R32-R35: each result quadrant copies a source quadrant, optionally flipped; a normal map flips the matching component (R34).
export const MIRROR_FRAGMENT = `
uniform sampler2D uSource;
uniform float uSize;
uniform vec4 uPlan[4]; // per result quadrant: source quadrant, flip x, flip y
uniform bool uNormal;
varying vec2 vUv;
void main() {
  float h = uSize * 0.5;
  vec2 p = floor(vUv * uSize);
  int quadrant = (p.y >= h ? 2 : 0) + (p.x >= h ? 1 : 0);
  vec4 plan = uPlan[quadrant];
  vec2 local = p - vec2(p.x >= h ? h : 0.0, p.y >= h ? h : 0.0);
  int from = int(plan.x + 0.5);
  vec2 origin = vec2(mod(float(from), 2.0) * h, float(from / 2) * h);
  vec2 source = origin + vec2(plan.y > 0.5 ? h - 1.0 - local.x : local.x, plan.z > 0.5 ? h - 1.0 - local.y : local.y);
  vec4 color = texture2D(uSource, (source + 0.5) / uSize);
  if (uNormal) {
    if (plan.y > 0.5) color.r = 1.0 - color.r;
    if (plan.z > 0.5) color.g = 1.0 - color.g;
  }
  gl_FragColor = vec4(color.rgb, 1.0);
}`;

// R36, R37: out(uv) = in(fract(uv * t + o)), each result texel averaging a box of t x t source texels (one tap at t = 1, so a swap is exact).
export const TILE_FRAGMENT = `${SRGB_ENCODE}
uniform sampler2D uSource;
uniform float uSize;
uniform vec2 uTiles;
uniform vec2 uOffset;
uniform vec2 uTaps;
uniform bool uNormal;
uniform bool uEncodeSrgb;
varying vec2 vUv;
void main() {
  vec3 sum = vec3(0.0);
  for (int i = 0; i < 10; i++) {
    if (float(i) >= uTaps.x) break;
    for (int j = 0; j < 10; j++) {
      if (float(j) >= uTaps.y) break;
      vec2 spread = (vec2((float(i) + 0.5) / uTaps.x, (float(j) + 0.5) / uTaps.y) - 0.5) / uSize;
      sum += texture2D(uSource, fract((vUv + spread) * uTiles + uOffset)).rgb;
    }
  }
  vec3 color = sum / (uTaps.x * uTaps.y);
  if (uNormal) color = renormalise(color);
  gl_FragColor = vec4(uEncodeSrgb ? encodeSrgb(color) : color, 1.0);
}`;

// R24, R26, R27, R30: a rectangle of the source scaled to the result. Bilinear, with a box prefilter when shrinking by more than 2x;
// the whole image wraps at its edges (R6), a crop clamps at its rectangle.
export const RESAMPLE_FRAGMENT = `${SRGB_ENCODE}
uniform sampler2D uSource;
uniform vec2 uSourceSize;
uniform vec4 uRect; // x, y, width, height in source texels
uniform float uSize;
uniform vec2 uTaps;
uniform bool uWrap;
uniform bool uNormal;
uniform bool uEncodeSrgb;
varying vec2 vUv;
void main() {
  vec3 sum = vec3(0.0);
  for (int i = 0; i < 16; i++) {
    if (float(i) >= uTaps.x) break;
    for (int j = 0; j < 16; j++) {
      if (float(j) >= uTaps.y) break;
      vec2 spread = (vec2((float(i) + 0.5) / uTaps.x, (float(j) + 0.5) / uTaps.y) - 0.5) / uSize;
      vec2 at = uRect.xy + (vUv + spread) * uRect.zw;
      if (!uWrap) at = clamp(at, uRect.xy + 0.5, uRect.xy + uRect.zw - 0.5);
      sum += texture2D(uSource, at / uSourceSize).rgb;
    }
  }
  vec3 color = sum / (uTaps.x * uTaps.y);
  if (uNormal) color = renormalise(color);
  gl_FragColor = vec4(uEncodeSrgb ? encodeSrgb(color) : color, 1.0);
}`;
