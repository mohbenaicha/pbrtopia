import {
  AddEquation, CustomBlending, NoBlending, OneFactor, OneMinusSrcAlphaFactor, ReverseSubtractEquation, ShaderMaterial, SrcAlphaFactor, ZeroFactor,
  type Blending, type BlendingDstFactor, type BlendingEquation, type BlendingSrcFactor, type IUniform, type Texture,
} from 'three';

// Compositing A4: the shaders of the stamp painter. One instanced draw per map per frame; no read of the target while it is written (hardware blending).

/** How a map target takes a stamp: `mix` blends towards the value by the stamp alpha, `add` and `subtract` move the target by value x alpha, `slope` sums the Edge burn tilt. */
export type StampBlend = 'mix' | 'add' | 'subtract' | 'slope';

export const STAMP_VERTEX = `
attribute vec4 iPlace; // centre x, centre y (picture fractions, unwrapped by the caller's wrap instances), size, angle
attribute vec4 iTile;  // atlas rectangle u0, v0, du, dv
attribute vec4 iBrush; // strength, hardness, invert, unused
varying vec2 vLocal;
varying vec4 vTile;
varying vec4 vBrush;
varying vec2 vTurn;
varying float vSize;
void main() {
  float c = cos(iPlace.w);
  float s = sin(iPlace.w);
  vec2 rotated = vec2(c * position.x - s * position.y, s * position.x + c * position.y) * iPlace.z;
  vLocal = position.xy + 0.5;
  vTile = iTile;
  vBrush = iBrush;
  vTurn = vec2(c, s);
  vSize = iPlace.z;
  gl_Position = vec4((iPlace.xy + rotated) * 2.0 - 1.0, 0.0, 1.0);
}`;

// coverage: the shape (atlas luminance, optionally inverted) times the hardness fade towards the box edge times strength. Local y points up like the picture's v;
// the first atlas rows are the top of a shape, so they sit at local y = 1.
const COVERAGE = `
uniform sampler2D uAtlas;
uniform vec4 uValue;
uniform float uTexel;
uniform float uGain;
varying vec2 vLocal;
varying vec4 vTile;
varying vec4 vBrush;
varying vec2 vTurn;
varying float vSize;
float coverage(vec2 local) {
  float shape = texture2D(uAtlas, vTile.xy + vec2(local.x, 1.0 - local.y) * vTile.zw).r;
  shape = mix(shape, 1.0 - shape, vBrush.z);
  vec2 box = abs(local * 2.0 - 1.0);
  float edge = max(box.x, box.y);
  float fade = vBrush.y >= 0.9999 ? 1.0 - step(1.0, edge) : 1.0 - smoothstep(vBrush.y, 1.0, edge);
  return shape * fade * vBrush.x;
}`;

const COLOUR_MAIN = `
void main() {
  gl_FragColor = vec4(uValue.rgb, coverage(vLocal));
}`;

// Edge burn: the slope of the coverage in stamp-local units (so a big and a small stamp look alike), central differences 1.5 target texels apart, turned into the
// picture's axes. The tilt written is the normal's xy contribution, -gradient x (+-gain), summed over stamps by ONE, ONE blending.
const SLOPE_MAIN = `
void main() {
  float d = max(1.5 * uTexel / vSize, 0.0001);
  vec2 gradient = vec2(
    coverage(vLocal + vec2(d, 0.0)) - coverage(vLocal - vec2(d, 0.0)),
    coverage(vLocal + vec2(0.0, d)) - coverage(vLocal - vec2(0.0, d))) / (2.0 * d);
  vec2 world = vec2(vTurn.x * gradient.x - vTurn.y * gradient.y, vTurn.y * gradient.x + vTurn.x * gradient.y);
  gl_FragColor = vec4(-world * uGain, 0.0, 1.0);
}`;

interface BlendSetup { blending: Blending; equation: BlendingEquation; src: BlendingSrcFactor; dst: BlendingDstFactor }
const BLENDS: Record<StampBlend, BlendSetup> = {
  mix: { blending: CustomBlending, equation: AddEquation, src: SrcAlphaFactor, dst: OneMinusSrcAlphaFactor },
  add: { blending: CustomBlending, equation: AddEquation, src: SrcAlphaFactor, dst: OneFactor },
  subtract: { blending: CustomBlending, equation: ReverseSubtractEquation, src: SrcAlphaFactor, dst: OneFactor },
  slope: { blending: CustomBlending, equation: AddEquation, src: OneFactor, dst: OneFactor },
};

/** The uniforms every stamp material shares: the atlas, the value to paint (rgb), the target texel size in picture fractions, and the signed Edge burn gain. */
export interface StampUniforms { [name: string]: IUniform; uAtlas: IUniform<Texture>; uValue: IUniform<[number, number, number, number]>; uTexel: IUniform<number>; uGain: IUniform<number> }

export function createStampMaterial(blend: StampBlend, atlas: Texture, texel: number): ShaderMaterial {
  const setup = BLENDS[blend];
  const uniforms: StampUniforms = { uAtlas: { value: atlas }, uValue: { value: [0, 0, 0, 0] }, uTexel: { value: texel }, uGain: { value: 0 } };
  const material = new ShaderMaterial({
    vertexShader: STAMP_VERTEX,
    fragmentShader: COVERAGE + (blend === 'slope' ? SLOPE_MAIN : COLOUR_MAIN),
    uniforms, depthTest: false, depthWrite: false, blending: setup.blending,
  });
  material.blendEquation = setup.equation;
  material.blendSrc = setup.src;
  material.blendDst = setup.dst;
  material.blendEquationAlpha = AddEquation;
  material.blendSrcAlpha = blend === 'slope' ? OneFactor : ZeroFactor; // the destination alpha is kept (a blend that lowered it would fade the albedo's alpha)
  material.blendDstAlpha = OneFactor;
  return material;
}

const SCREEN_VERTEX = 'varying vec2 vUv; void main() { vUv = uv; gl_Position = vec4(position.xy * 2.0, 0.0, 1.0); }';

/**
 * Compositing A4.4: the stored normal plus the summed tilt, folded with the partial-derivative blend of imageops R82: (n1.xy x n2.z + n2.xy x n1.z, n1.z x n2.z)
 * with n2 = (tilt, 1). Where nothing tilts the stored bytes pass through unchanged. `uYSign` is -1 for DirectX maps (the tilt is made in OpenGL terms).
 */
export function createComposeMaterial(base: Texture, slope: Texture, yTiltSign: number): ShaderMaterial {
  return new ShaderMaterial({
    vertexShader: SCREEN_VERTEX,
    fragmentShader: `
      uniform sampler2D uBase;
      uniform sampler2D uSlope;
      uniform float uYSign;
      varying vec2 vUv;
      void main() {
        vec4 stored = texture2D(uBase, vUv);
        vec2 tilt = texture2D(uSlope, vUv).rg;
        if (dot(tilt, tilt) < 1e-12) { gl_FragColor = stored; return; }
        tilt.y *= uYSign;
        vec3 n1 = stored.xyz * 2.0 - 1.0;
        vec3 n = normalize(vec3(n1.xy + tilt * n1.z, n1.z));
        gl_FragColor = vec4(n * 0.5 + 0.5, stored.a);
      }`,
    uniforms: { uBase: { value: base }, uSlope: { value: slope }, uYSign: { value: yTiltSign } },
    depthTest: false, depthWrite: false, blending: NoBlending,
  });
}

/** A one-channel target made readable: `readRenderTargetPixels` on RED is not guaranteed by WebGL2, so the value is copied into RGBA first. */
export function createRedCopyMaterial(source: Texture): ShaderMaterial {
  return new ShaderMaterial({
    vertexShader: SCREEN_VERTEX,
    fragmentShader: 'uniform sampler2D uSource; varying vec2 vUv; void main() { gl_FragColor = vec4(texture2D(uSource, vUv).rrr, 1.0); }',
    uniforms: { uSource: { value: source } }, depthTest: false, depthWrite: false, blending: NoBlending,
  });
}
