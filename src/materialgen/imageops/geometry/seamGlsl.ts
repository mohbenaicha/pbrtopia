/**
 * Imageops R64-R68: the Blend edges blend as GLSL, written once. The viewport's shaders (preview) and the Apply pass both include this very text, so they cannot
 * drift apart (R2). `p` is a point of the picture with the first row on top; `flipV` is 1 when the bound texture has its top at v = 1 (the viewport's maps) and 0
 * when v = 0 is the top row (the Apply pass). `gx` and `gy` are the gradients for the filtering (zero where there are none: the vertex stage and Apply).
 * The profile (R66, R67) is a float texture of N x 2 texels, row 0 the depth of each picture row and row 1 of each column, read with two nearest fetches and a lerp.
 */
export const SEAM_GLSL = `
float seamWeight(float distance, float depth) {
  return depth > 0.0 ? clamp(1.0 - distance / depth, 0.0, 1.0) : 0.0;
}
float seamProfileDepth(sampler2D profile, float line, int which) {
  int n = textureSize(profile, 0).x;
  float t = clamp(line * float(n) - 0.5, 0.0, float(n - 1));
  int first = int(floor(t));
  int second = min(first + 1, n - 1);
  return mix(texelFetch(profile, ivec2(first, which), 0).r, texelFetch(profile, ivec2(second, which), 0).r, t - float(first));
}
float seamDepth(sampler2D profile, bool canny, float fixedDepth, int which, float line) {
  return canny ? seamProfileDepth(profile, line, which) : fixedDepth;
}
vec4 seamTap(sampler2D s, vec2 p, float flipV, vec2 gx, vec2 gy) {
  return textureGrad(s, vec2(p.x, mix(p.y, 1.0 - p.y, flipV)), gx, gy);
}
// H of R64: the picture row of p blended with its mirror image across the middle, strongest at the left border.
vec4 seamRow(sampler2D s, sampler2D profile, bool canny, float fixedDepth, vec2 p, float flipV, vec2 gx, vec2 gy) {
  vec4 here = seamTap(s, p, flipV, gx, gy);
  float texel = 1.0 / float(textureSize(s, 0).x);
  float w = seamWeight(max(p.x - 0.5 * texel, 0.0), seamDepth(profile, canny, fixedDepth, 0, p.y));
  return w > 0.0 ? mix(here, seamTap(s, vec2(1.0 - p.x, p.y), flipV, gx, gy), w) : here;
}
// out of R64: H blended with H of the row across the middle, strongest at the top border. At most four map taps.
vec4 seamBlend(sampler2D s, sampler2D profile, bool canny, float fixedDepth, vec2 p, float flipV, vec2 gx, vec2 gy) {
  vec4 h = seamRow(s, profile, canny, fixedDepth, p, flipV, gx, gy);
  float texel = 1.0 / float(textureSize(s, 0).y);
  float w = seamWeight(max(p.y - 0.5 * texel, 0.0), seamDepth(profile, canny, fixedDepth, 1, p.x));
  return w > 0.0 ? mix(h, seamRow(s, profile, canny, fixedDepth, vec2(p.x, 1.0 - p.y), flipV, gx, gy), w) : h;
}`;
