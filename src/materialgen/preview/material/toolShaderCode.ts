import { SEAM_GLSL } from '@mat/imageops';

// Imageops R53-R56, preview R58: the GLSL that puts an open Crop or Mirror on every map sample. Picture coordinates have the first row on top (the textures are
// uploaded flipped, so the top is v = 1); the transform works in picture coordinates and the sample goes back to texture coordinates. All of it is one coordinate
// computation per sample: no texture, no pass. Every map is read by UV (R57), the Material ball's included.

// Preview R60: 1 when the stored normal map is read as DirectX (green down): the normal-map read turns the green before use. Fragment shaders only.
const NORMAL_FLIP_UNIFORM = `
uniform float uNormalFlipY;
`;

export const TOOL_UNIFORMS = `
uniform vec2 uToolTile; // the tiling (preview R15)
uniform int uToolMode; // 0 none, 1 crop, 2 mirror
uniform vec4 uToolRect; // crop: x, y, width, height as fractions of the picture
uniform vec4 uToolPlan[4]; // mirror, by result quadrant: source quadrant, flip x, flip y
uniform vec4 uToolMarks; // crop: the marked edge (1 top, 2 left, 3 right, 4 bottom) in x; mirror: 1 for each selected quadrant
uniform sampler2D uToolProfile; // blend edges: the Canny depth of each row and column (imageops R66), N x 2 floats
`;

// R54: where the result point of tile coordinate `uv` reads the source; `flip` tells which components of a normal map a mirrored quadrant flips (R34).
export const TOOL_COORD = `
vec2 toolCoord(vec2 uv, out vec2 flip) {
  flip = vec2(0.0);
  vec2 p = vec2(fract(uv.x), 1.0 - fract(uv.y));
  vec2 t = p;
  if (uToolMode == 1) {
    t = uToolRect.xy + p * uToolRect.zw;
  } else if (uToolMode == 2) {
    int q = (p.y >= 0.5 ? 2 : 0) + (p.x >= 0.5 ? 1 : 0);
    vec4 plan = uToolPlan[q];
    vec2 local = p - vec2(p.x >= 0.5 ? 0.5 : 0.0, p.y >= 0.5 ? 0.5 : 0.0);
    vec2 inside = vec2(plan.y > 0.5 ? 0.5 - local.x : local.x, plan.z > 0.5 ? 0.5 - local.y : local.y);
    int source = int(plan.x + 0.5);
    t = vec2(mod(float(source), 2.0), float(source / 2)) * 0.5 + inside;
    flip = plan.yz;
  }
  return vec2(t.x, 1.0 - t.y);
}
`;

// The fragment side: explicit gradients keep the filtering smooth across a mirror seam and as sharp as the resample of a crop (R30).
const TOOL_SAMPLE = `
vec4 toolSample(sampler2D s, vec2 uv, out vec2 flip) {
  flip = vec2(0.0);
  if (uToolMode == 0) return texture2D(s, uv);
  vec2 gx = dFdx(uv);
  vec2 gy = dFdy(uv);
  if (uToolMode == 3) return seamBlend(s, uToolProfile, uToolRect.z > 0.5, uToolRect.x, vec2(fract(uv.x), 1.0 - fract(uv.y)), 1.0, gx, gy); // blend edges (imageops R64)
  if (uToolMode == 1) {
    gx *= uToolRect.zw;
    gy *= uToolRect.zw;
  }
  return textureGrad(s, toolCoord(uv, flip), gx, gy);
}
`;

export const TOOL_FRAGMENT = `
vec4 toolTexel(sampler2D s, vec2 uv) {
  vec2 flip;
  return toolSample(s, uv, flip);
}
vec4 toolNormalTexel(sampler2D s, vec2 uv) {
  vec2 flip;
  vec4 c = toolSample(s, uv, flip);
  if (flip.x > 0.5) c.r = 1.0 - c.r;
  if (flip.y > 0.5) c.g = 1.0 - c.g;
  if (uNormalFlipY > 0.5) c.g = 1.0 - c.g;
  return c;
}
// R55, R56: the cyan line (alpha 0.7, 0.015 of the side) on the marked crop edge or the outer edges of the selected mirror quadrants of the result picture.
float toolMark(vec2 uv) {
  if (uToolMode == 0 || uToolMode == 3) return 0.0;
  vec2 p = vec2(fract(uv.x), 1.0 - fract(uv.y));
  float w = 0.015;
  bool on = false;
  if (uToolMode == 1) {
    float e = uToolMarks.x;
    on = (e > 0.5 && e < 1.5 && p.y < w) || (e > 1.5 && e < 2.5 && p.x < w) || (e > 2.5 && e < 3.5 && p.x > 1.0 - w) || (e > 3.5 && p.y > 1.0 - w);
  } else {
    bool right = p.x >= 0.5;
    bool bottom = p.y >= 0.5;
    int q = (bottom ? 2 : 0) + (right ? 1 : 0);
    on = uToolMarks[q] > 0.5 && ((bottom ? p.y > 1.0 - w : p.y < w) || (right ? p.x > 1.0 - w : p.x < w));
  }
  return on ? 0.7 : 0.0;
}
vec3 toolMarked(vec3 color, vec2 uv) {
  return mix(color, vec3(0.0, 1.0, 1.0), toolMark(uv));
}
`;

// The vertex side (displacement): the base level, with the same coordinate. The seam columns of the Material ball read one texel (R57), so welded vertices read one height.
export const TOOL_VERTEX = `
vec4 toolTexelVertex(sampler2D s, vec2 uv) {
  if (uToolMode == 0) return texture2D(s, uv);
  if (uToolMode == 3) return texture2D(s, uv); // R76: the blend is not computed per vertex
  vec2 flip;
  return texture2D(s, toolCoord(uv, flip));
}
`;

export const TOOL_FRAGMENT_SUPPORT = NORMAL_FLIP_UNIFORM + TOOL_UNIFORMS + SEAM_GLSL + TOOL_COORD + TOOL_SAMPLE + TOOL_FRAGMENT;
export const TOOL_VERTEX_SUPPORT = TOOL_UNIFORMS + TOOL_COORD + TOOL_VERTEX;
