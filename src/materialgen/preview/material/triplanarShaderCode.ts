// Preview R57: the GLSL of sampling a map by the point's position on the model (triplanar mapping) instead of by UV. The point is projected along the three axes, each
// projection is read like a picture of its own, and the three reads are blended by how much the surface faces that axis. A texture that depends on position only has no
// chart, so it has no seam, no stretch and no pole. It is on when `uTriplanar` (repeats per unit of length) is above 0; the Ball and the Plane keep their UVs.

export const TRI_UNIFORMS = `
uniform float uTriplanar; // 0: maps are read by UV; above 0: by position, this many repeats per unit of length at tiling 1
uniform vec2 uToolTile; // the tiling (preview R15)
`;

// Preview R60: 1 when the stored normal map is read as DirectX (green down): every normal-map read turns the green before use. Fragment shaders only.
export const NORMAL_FLIP_UNIFORM = `
uniform float uNormalFlipY;
`;

// The model's own position and smooth normal, which the vertex shader hands on (a vertex and its fragment agree on them, so welded vertices read one height).
export const TRI_VARYINGS = `
varying vec3 vTriPosition;
varying vec3 vTriNormal;
`;

// The weights |n|^4, the side each axis is seen from, and the picture coordinate of a point in each projection. Each projection is a right-handed frame (right, up, out of the
// surface) whose "out" is the side n faces, so a picture is never mirrored and a normal map keeps its handedness on the back faces; the frames are repeated in triNormalShaded.
export const TRI_COMMON = `
vec3 triWeights(vec3 n) {
  vec3 w = pow(abs(n), vec3(4.0));
  return w / (w.x + w.y + w.z);
}
vec3 triSigns(vec3 n) {
  return vec3(n.x >= 0.0 ? 1.0 : -1.0, n.y >= 0.0 ? 1.0 : -1.0, n.z >= 0.0 ? 1.0 : -1.0);
}
vec2 triUv(int axis, vec3 p, vec3 signs) {
  vec2 k = uTriplanar * uToolTile;
  if (axis == 0) return vec2(-signs.x * p.z, p.y) * k;
  if (axis == 1) return vec2(p.x, -signs.y * p.z) * k;
  return vec2(signs.z * p.x, p.y) * k;
}
`;

// The fragment side; it calls toolSample, so it follows it. TOOL_LIT is defined only by the patch of the lit material, which has the view normal and the frames of the axes.
export const TRI_FRAGMENT = `
vec4 triTexel(sampler2D s) {
  vec3 n = normalize(vTriNormal);
  vec3 w = triWeights(n);
  vec3 g = triSigns(n);
  vec2 flip;
  return toolSample(s, triUv(0, vTriPosition, g), flip) * w.x + toolSample(s, triUv(1, vTriPosition, g), flip) * w.y + toolSample(s, triUv(2, vTriPosition, g), flip) * w.z;
}
// The label map is never blended (a blend of two labels is a third label): the projection the surface faces most.
vec4 triDominantTexel(sampler2D s) {
  vec3 n = normalize(vTriNormal);
  vec3 a = abs(n);
  int axis = (a.x >= a.y && a.x >= a.z) ? 0 : (a.y >= a.z ? 1 : 2);
  return texture2D(s, triUv(axis, vTriPosition, triSigns(n)));
}
vec3 triNormalSample(sampler2D s, int axis, vec3 g) {
  vec2 flip;
  vec4 c = toolSample(s, triUv(axis, vTriPosition, g), flip);
  if (flip.x > 0.5) c.r = 1.0 - c.r;
  if (flip.y > 0.5) c.g = 1.0 - c.g;
  if (uNormalFlipY > 0.5) c.g = 1.0 - c.g;
  return c.xyz * 2.0 - 1.0;
}
// The flat Normal view: the stored colour of the three projections, blended.
vec4 triNormalRaw(sampler2D s) {
  vec3 n = normalize(vTriNormal);
  vec3 w = triWeights(n);
  vec3 g = triSigns(n);
  vec3 t = triNormalSample(s, 0, g) * w.x + triNormalSample(s, 1, g) * w.y + triNormalSample(s, 2, g) * w.z;
  return vec4(t * 0.5 + 0.5, 1.0);
}
#ifdef TOOL_LIT
varying vec3 vTriAxisX; // the model's x, y and z axes in view space
varying vec3 vTriAxisY;
varying vec3 vTriAxisZ;
varying vec3 vTriView; // the smooth normal in view space (three's own vNormal is declared after this code)
mat3 triFrame(vec3 n) {
  vec3 up = abs(n.y) < 0.99 ? vec3(0.0, 1.0, 0.0) : vec3(1.0, 0.0, 0.0);
  vec3 t = normalize(cross(up, n));
  return mat3(t, cross(n, t), n);
}
// The whiteout blend of a tangent-space normal t (right a, up b, out c) with the surface normal n, back in the model's space.
vec3 triWhiteout(vec3 t, vec3 a, vec3 b, vec3 c, vec3 n) {
  vec3 r = vec3(t.xy + vec2(dot(n, a), dot(n, b)), abs(t.z) * dot(n, c));
  return a * r.x + b * r.y + c * r.z;
}
// The perturbed normal of the three projections (whiteout blend), as a tangent-space vector (packed to 0..1) in the frame of the smooth view normal, which is the form
// the normal chunk of the lit material and its Strength and Contrast tilt already work on.
vec4 triNormalShaded(sampler2D s) {
  vec3 n = normalize(vTriNormal);
  vec3 w = triWeights(n);
  vec3 g = triSigns(n);
  vec3 blended = triWhiteout(triNormalSample(s, 0, g), vec3(0.0, 0.0, -g.x), vec3(0.0, 1.0, 0.0), vec3(g.x, 0.0, 0.0), n) * w.x
    + triWhiteout(triNormalSample(s, 1, g), vec3(1.0, 0.0, 0.0), vec3(0.0, 0.0, -g.y), vec3(0.0, g.y, 0.0), n) * w.y
    + triWhiteout(triNormalSample(s, 2, g), vec3(g.z, 0.0, 0.0), vec3(0.0, 1.0, 0.0), vec3(0.0, 0.0, g.z), n) * w.z;
  vec3 modelN = normalize(blended);
  vec3 viewN = normalize(vTriAxisX * modelN.x + vTriAxisY * modelN.y + vTriAxisZ * modelN.z);
  mat3 frame = triFrame(normalize(vTriView));
  return vec4(vec3(dot(frame[0], viewN), dot(frame[1], viewN), dot(frame[2], viewN)) * 0.5 + 0.5, 1.0);
}
#endif
`;
