// Imageops R14-R23: the filter fragment shaders. The spatial shader is one pass of the chain (it reads the previous pass, never the source,
// unless it is the first); the tone shader is the last pass: the luminance chain, then the colour block for albedo, then the 8-bit write.
// Radii are in texels of the map at size S and reach the shader as fractions of the image (radius / S), so a preview at a smaller size
// samples the same footprint (R21). Samplers wrap (R6).

export const SPATIAL_FRAGMENT = `
uniform sampler2D uSource;
uniform int uMode; // 0 blur, 1 denoise, 2 sharpness, 3 highpass, 4 clarity, 5 edge emphasis, 6 contrast by scale, 7 colour mixin
uniform float uAmount;
uniform vec3 uBands;
uniform float uTexelsToUv; // 1 / S: converts a radius in texels of the map at size S to a fraction of the image
uniform vec2 uPassTexel;   // 1 / (size of this pass), for the fixed 3 x 3 edge kernel
uniform bool uNormal;
uniform sampler2D uAlbedoTex; // the albedo, for the colour mixin (mode 7); the source itself when there is none
varying vec2 vUv;

float luma(vec3 c) { return dot(c, vec3(0.2126, 0.7152, 0.0722)); }

// 32 taps on a golden-angle spiral, Gaussian weight exp(-4 r^2) with r the distance as a fraction of the radius.
vec3 blurAt(float radiusTexels) {
  float radius = radiusTexels * uTexelsToUv;
  vec3 sum = vec3(0.0);
  float total = 0.0;
  for (int i = 0; i < 32; i++) {
    float t = (float(i) + 0.5) / 32.0;
    float angle = float(i) * 2.39996323;
    float weight = exp(-4.0 * t);
    sum += weight * texture2D(uSource, vUv + radius * sqrt(t) * vec2(cos(angle), sin(angle))).rgb;
    total += weight;
  }
  return sum / total;
}

vec3 renormalise(vec3 rgb) {
  vec3 n = rgb * 2.0 - 1.0;
  n.z = max(n.z, 0.0);
  float len = length(n);
  return len > 1e-5 ? n / len * 0.5 + 0.5 : vec3(0.5, 0.5, 1.0);
}

void main() {
  vec3 c = texture2D(uSource, vUv).rgb;
  vec3 result = c;
  if (uMode == 0) {
    result = blurAt(uAmount);
  } else if (uMode == 1) {
    vec3 b = blurAt(2.0 * uAmount);
    float strength = clamp(uAmount / 3.0, 0.0, 1.0);
    result = mix(c, b, 0.7 * strength * (1.0 - smoothstep(0.04, 0.25, length(c - b)))); // flat areas smooth, strong edges stay
    if (uNormal) result = renormalise(result);
  } else if (uMode == 2) {
    result = c + (c - blurAt(1.5)) * uAmount;
  } else if (uMode == 3) {
    result = c + (c - blurAt(4.0)) * uAmount;
  } else if (uMode == 4) {
    float l = clamp(luma(c), 0.0, 1.0);
    result = c + (c - blurAt(4.0)) * uAmount * (4.0 * l * (1.0 - l)) * 0.5; // midtones only
  } else if (uMode == 5) {
    float tl = luma(texture2D(uSource, vUv + vec2(-uPassTexel.x, -uPassTexel.y)).rgb);
    float tc = luma(texture2D(uSource, vUv + vec2(0.0, -uPassTexel.y)).rgb);
    float tr = luma(texture2D(uSource, vUv + vec2(uPassTexel.x, -uPassTexel.y)).rgb);
    float ml = luma(texture2D(uSource, vUv + vec2(-uPassTexel.x, 0.0)).rgb);
    float mr = luma(texture2D(uSource, vUv + vec2(uPassTexel.x, 0.0)).rgb);
    float bl = luma(texture2D(uSource, vUv + vec2(-uPassTexel.x, uPassTexel.y)).rgb);
    float bc = luma(texture2D(uSource, vUv + vec2(0.0, uPassTexel.y)).rgb);
    float br = luma(texture2D(uSource, vUv + vec2(uPassTexel.x, uPassTexel.y)).rgb);
    float gx = (tr + 2.0 * mr + br) - (tl + 2.0 * ml + bl);
    float gy = (bl + 2.0 * bc + br) - (tl + 2.0 * tc + tr);
    result = c + vec3(length(vec2(gx, gy)) * uAmount * 0.5);
  } else if (uMode == 6) {
    vec3 wide = blurAt(6.0);
    vec3 narrow = blurAt(2.0);
    result = wide * uBands.x + (narrow - wide) * uBands.y + (c - narrow) * uBands.z; // large, medium and fine scales
  } else {
    // R83: the albedo's luma as a height field, its central-difference slope per texel of the map at size S, as a detail normal joined to this one.
    // Picture rows run downward in v and the stored normal is OpenGL (green up), so x leans against the slope and y with it.
    float d = uTexelsToUv;
    float left = luma(texture2D(uAlbedoTex, vUv - vec2(d, 0.0)).rgb);
    float right = luma(texture2D(uAlbedoTex, vUv + vec2(d, 0.0)).rgb);
    float above = luma(texture2D(uAlbedoTex, vUv - vec2(0.0, d)).rgb);
    float below = luma(texture2D(uAlbedoTex, vUv + vec2(0.0, d)).rgb);
    vec3 detail = normalize(vec3(vec2(left - right, below - above) * 0.5 * uAmount * 8.0, 1.0));
    vec3 base = c * 2.0 - 1.0;
    base.z = max(base.z, 1e-3);
    vec3 mixed = vec3(base.xy * detail.z + detail.xy * base.z, base.z * detail.z);
    result = renormalise(normalize(mixed) * 0.5 + 0.5);
  }
  gl_FragColor = vec4(result, 1.0);
}`;

export const TONE_FRAGMENT = `
uniform sampler2D uSource;
uniform bool uAlbedo;     // linear light in, sRGB out (R4)
uniform bool uGrey;       // one channel (R23)
uniform vec2 uNormalizeRange; // x min, y max of the source luma; x < y only when Normalise is on
uniform vec3 uLevels;     // min, mid, max
uniform vec4 uExposure;   // exposure, brightness, contrast, gamma
uniform vec4 uTone;       // highlights, shadows, whites, blacks
uniform vec4 uShape;      // histogram remap, height intensity, bias, invert (0 or 1)
uniform vec4 uColorA;     // saturation, hue (degrees), chroma, vibrance
uniform vec2 uColorB;     // temperature, tint
varying vec2 vUv;

float luma(vec3 c) { return dot(c, vec3(0.2126, 0.7152, 0.0722)); }

vec3 encodeSrgb(vec3 c) {
  c = clamp(c, 0.0, 1.0);
  return mix(c * 12.92, 1.055 * pow(c, vec3(1.0 / 2.4)) - 0.055, step(0.0031308, c));
}

vec3 rgbToHsv(vec3 c) {
  vec4 K = vec4(0.0, -1.0 / 3.0, 2.0 / 3.0, -1.0);
  vec4 p = mix(vec4(c.bg, K.wz), vec4(c.gb, K.xy), step(c.b, c.g));
  vec4 q = mix(vec4(p.xyw, c.r), vec4(c.r, p.yzx), step(p.x, c.r));
  float d = q.x - min(q.w, q.y);
  return vec3(abs(q.z + (q.w - q.y) / (6.0 * d + 1e-10)), d / (q.x + 1e-10), q.x);
}

vec3 hsvToRgb(vec3 c) {
  vec3 p = abs(fract(c.xxx + vec3(1.0, 2.0 / 3.0, 1.0 / 3.0)) * 6.0 - 3.0);
  return c.z * mix(vec3(1.0), clamp(p - 1.0, 0.0, 1.0), c.y);
}

void main() {
  vec3 color = texture2D(uSource, vUv).rgb;
  if (uGrey) color = vec3(color.r);
  float original = luma(color);
  float v = original;

  if (uNormalizeRange.y > uNormalizeRange.x) v = (v - uNormalizeRange.x) / (uNormalizeRange.y - uNormalizeRange.x);
  if (uLevels.x != 0.0 || uLevels.y != 1.0 || uLevels.z != 1.0) v = pow(clamp((v - uLevels.x) / max(uLevels.z - uLevels.x, 1e-4), 0.0, 1.0), 1.0 / uLevels.y);
  if (uExposure.x != 0.0) v *= exp2(uExposure.x);
  if (uExposure.y != 0.0) v += uExposure.y;
  if (uExposure.z != 1.0) v = (v - 0.5) * uExposure.z + 0.5;
  if (uTone.x != 0.0) v += uTone.x * v * v * 0.5;
  if (uTone.y != 0.0) v += uTone.y * (1.0 - v) * (1.0 - v) * 0.5;
  if (uTone.z != 0.0) v += uTone.z * smoothstep(0.5, 1.0, v) * 0.3;
  if (uTone.w != 0.0) v += uTone.w * (1.0 - smoothstep(0.0, 0.5, v)) * 0.3;
  if (uExposure.w != 1.0) v = pow(max(v, 0.0), uExposure.w);
  if (uShape.x != 1.0) v = pow(max(v, 0.0), uShape.x);
  if (uShape.y != 1.0) v = (v - 0.5) * uShape.y + 0.5;
  if (uShape.z != 0.0) v += uShape.z;
  if (uShape.w > 0.5) v = 1.0 - v;
  v = clamp(v, 0.0, 1.0);

  bool lumaChanged = v != clamp(original, 0.0, 1.0) || uNormalizeRange.y > uNormalizeRange.x;
  if (lumaChanged) color = original < 0.001 ? vec3(v) : color * (v / original);
  color = clamp(color, 0.0, 1.0);

  if (uAlbedo) {
    if (uColorA.x != 1.0) color = mix(vec3(luma(color)), color, uColorA.x);
    if (uColorA.y != 0.0 || uColorA.z != 1.0 || uColorA.w != 0.0) {
      vec3 hsv = rgbToHsv(color);
      hsv.x = fract(hsv.x + uColorA.y / 360.0);
      hsv.y *= uColorA.z;
      hsv.y += (1.0 - hsv.y) * hsv.z * uColorA.w * 0.5;
      color = hsvToRgb(vec3(hsv.x, clamp(hsv.y, 0.0, 1.0), hsv.z));
    }
    if (uColorB.x != 0.0) color += vec3(uColorB.x * 0.15, 0.0, -uColorB.x * 0.15);
    if (uColorB.y != 0.0) color += vec3(-uColorB.y * 0.075, uColorB.y * 0.15, -uColorB.y * 0.075);
    color = encodeSrgb(color);
  } else {
    color = clamp(color, 0.0, 1.0);
  }
  gl_FragColor = vec4(color, 1.0);
}`;
