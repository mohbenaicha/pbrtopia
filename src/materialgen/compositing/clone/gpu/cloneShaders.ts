import {
  AddEquation, CustomBlending, MaxEquation, NoBlending, OneFactor, OneMinusSrcAlphaFactor, ShaderMaterial, SrcAlphaFactor, ZeroFactor, type Texture,
} from 'three';
import { STAMP_VERTEX } from '../../gpu/stampShaders';

// Clone architecture C4: the shaders of the Clone mode. Every draw is on the GPU; nothing here reads a texel back.

/** The shape the highlight brush paints, and the ghost shows (clone R3). */
export type HighlightShape = 'round' | 'square';

const SCREEN_VERTEX = 'void main() { gl_Position = vec4(position.xy * 2.0, 0.0, 1.0); }';

/** A painted highlight is a set: the target keeps the larger of what is there and what a stamp adds (clone R4). */
export function createMaskMaterial(shape: HighlightShape): ShaderMaterial {
  const material = new ShaderMaterial({
    vertexShader: STAMP_VERTEX, // the stamp's placement: centre, size and angle per instance
    fragmentShader: `
      varying vec2 vLocal;
      void main() {
        float distanceFromCentre = length(vLocal - 0.5);
        float soft = max(fwidth(distanceFromCentre), 0.0001);
        float inside = ${shape === 'round' ? '1.0 - smoothstep(0.5 - soft, 0.5, distanceFromCentre)' : '1.0'};
        gl_FragColor = vec4(inside, 0.0, 0.0, 1.0);
      }`,
    depthTest: false, depthWrite: false, blending: CustomBlending,
  });
  material.blendEquation = MaxEquation;
  material.blendSrc = OneFactor;
  material.blendDst = OneFactor;
  return material;
}

/** What a capture pass reads: the picture's maps (repeating), and where in them the lifted rectangle starts, in texels. */
export interface CaptureSources { albedo: Texture; orm: Texture; height: Texture | null; normal: Texture | null }

const CAPTURE_HEAD = `
  uniform vec2 uOrigin; // the lifted rectangle's first texel, unwrapped: the sources repeat
  uniform float uSide;
  vec2 pictureUv() { return (uOrigin + gl_FragCoord.xy) / uSide; }
`;

/** The albedo of the lifted rectangle, as stored (clone R8): the colour of every texel, also outside the highlight (no dark fringe, R10). */
export function createColourCaptureMaterial(albedo: Texture): ShaderMaterial {
  return new ShaderMaterial({
    vertexShader: SCREEN_VERTEX,
    fragmentShader: `${CAPTURE_HEAD} uniform sampler2D uAlbedo; void main() { gl_FragColor = texture2D(uAlbedo, pictureUv()); }`,
    uniforms: { uAlbedo: { value: albedo }, uOrigin: { value: [0, 0] }, uSide: { value: 1 } }, depthTest: false, depthWrite: false, blending: NoBlending,
  });
}

/** Height, roughness and metal of the lifted rectangle in one texture (r, g, b); height is 0 when the map does not exist (clone R14). */
export function createSurfaceCaptureMaterial(orm: Texture, height: Texture | null): ShaderMaterial {
  return new ShaderMaterial({
    vertexShader: SCREEN_VERTEX,
    fragmentShader: `${CAPTURE_HEAD} uniform sampler2D uOrm; uniform sampler2D uHeight; uniform float uHasHeight;
      void main() { vec2 uv = pictureUv(); vec4 roughMetal = texture2D(uOrm, uv); gl_FragColor = vec4(uHasHeight * texture2D(uHeight, uv).r, roughMetal.g, roughMetal.b, 1.0); }`,
    uniforms: { uOrm: { value: orm }, uHeight: { value: height ?? orm }, uHasHeight: { value: height === null ? 0 : 1 }, uOrigin: { value: [0, 0] }, uSide: { value: 1 } },
    depthTest: false, depthWrite: false, blending: NoBlending,
  });
}

/** The composed normal of the lifted rectangle, with z kept off zero so a later turn never divides by nothing (clone C7). */
export function createNormalCaptureMaterial(normal: Texture): ShaderMaterial {
  return new ShaderMaterial({
    vertexShader: SCREEN_VERTEX,
    fragmentShader: `${CAPTURE_HEAD} uniform sampler2D uNormal;
      void main() {
        vec4 stored = texture2D(uNormal, pictureUv());
        vec3 n = stored.xyz * 2.0 - 1.0;
        n.z = max(n.z, 0.05);
        gl_FragColor = vec4(normalize(n) * 0.5 + 0.5, stored.a);
      }`,
    uniforms: { uNormal: { value: normal }, uOrigin: { value: [0, 0] }, uSide: { value: 1 } }, depthTest: false, depthWrite: false, blending: NoBlending,
  });
}

/**
 * Clone R10: one pass of the box blur that turns the highlight into the fade. `uSourceSize` is the size of the source in texels, `uOrigin` where the pass's first texel
 * lies in it, `uAxis` the direction; a radius of 0 copies. At most 2 x 64 + 1 taps, all at texel centres, so the result is exact.
 */
export function createBlurMaterial(source: Texture): ShaderMaterial {
  return new ShaderMaterial({
    vertexShader: SCREEN_VERTEX,
    fragmentShader: `
      uniform sampler2D uSource;
      uniform vec2 uOrigin;
      uniform vec2 uSourceSize;
      uniform vec2 uAxis;
      uniform float uRadius;
      void main() {
        vec2 uv = (uOrigin + gl_FragCoord.xy) / uSourceSize;
        vec2 stride = uAxis / uSourceSize;
        float sum = 0.0;
        for (int i = -64; i <= 64; i++) {
          if (abs(float(i)) > uRadius) continue;
          sum += texture2D(uSource, uv + float(i) * stride).r;
        }
        gl_FragColor = vec4(sum / (2.0 * uRadius + 1.0), 0.0, 0.0, 1.0);
      }`,
    uniforms: { uSource: { value: source }, uOrigin: { value: [0, 0] }, uSourceSize: { value: [1, 1] }, uAxis: { value: [1, 0] }, uRadius: { value: 0 } },
    depthTest: false, depthWrite: false, blending: NoBlending,
  });
}

export type BakeKind = 'albedo' | 'orm' | 'height' | 'slope' | 'override';

/** What a bake draw reads: the lifted layer and its fade. */
export interface BakeSources { colour: Texture; surface: Texture; normal: Texture; fade: Texture }

/**
 * Clone R9-R11, R14, R15: the copy drawn into one map. The quad is the lifted rectangle placed (centre, scale, turn) in picture fractions; the fragment's alpha is the
 * fade times the Strength. Albedo, roughness+metal and height blend towards the copy; the slope blends towards zero (the copy's own Edge burn is in its normal); the
 * normal override takes the copied normal, turned with the copy, premultiplied.
 */
export function createBakeMaterial(kind: BakeKind, sources: BakeSources, normalYSign: number): ShaderMaterial {
  const output: Record<BakeKind, string> = {
    albedo: 'gl_FragColor = vec4(texture2D(uColour, vLocal).rgb, alpha);',
    orm: 'vec4 surface = texture2D(uSurface, vLocal); gl_FragColor = vec4(0.0, surface.g, surface.b, alpha);',
    height: 'gl_FragColor = vec4(texture2D(uSurface, vLocal).r, 0.0, 0.0, alpha);',
    slope: 'gl_FragColor = vec4(0.0, 0.0, 0.0, alpha);',
    override: `
      vec3 n = texture2D(uNormal, vLocal).xyz * 2.0 - 1.0;
      vec2 openGl = vec2(n.x, n.y * uYSign);
      float c = cos(uAngle);
      float s = sin(uAngle);
      vec2 turned = vec2(c * openGl.x - s * openGl.y, s * openGl.x + c * openGl.y);
      vec3 encoded = vec3(turned.x, turned.y * uYSign, n.z) * 0.5 + 0.5;
      gl_FragColor = vec4(encoded * alpha, alpha);`,
  };
  const material = new ShaderMaterial({
    vertexShader: `
      uniform vec2 uCentre;
      uniform vec3 uFrame; // the lifted rectangle's width and height in picture fractions, and the scale
      uniform float uAngle;
      varying vec2 vLocal;
      void main() {
        vec2 offset = position.xy * uFrame.xy * uFrame.z;
        float c = cos(uAngle);
        float s = sin(uAngle);
        vec2 at = uCentre + vec2(c * offset.x - s * offset.y, s * offset.x + c * offset.y);
        vLocal = position.xy + 0.5;
        gl_Position = vec4(at * 2.0 - 1.0, 0.0, 1.0);
      }`,
    fragmentShader: `
      uniform sampler2D uColour;
      uniform sampler2D uSurface;
      uniform sampler2D uNormal;
      uniform sampler2D uFade;
      uniform float uStrength;
      uniform float uAngle;
      uniform float uYSign;
      varying vec2 vLocal;
      void main() {
        float alpha = texture2D(uFade, vLocal).r * uStrength;
        ${output[kind]}
      }`,
    uniforms: {
      uColour: { value: sources.colour }, uSurface: { value: sources.surface }, uNormal: { value: sources.normal }, uFade: { value: sources.fade },
      uCentre: { value: [0, 0] }, uFrame: { value: [1, 1, 1] }, uAngle: { value: 0 }, uStrength: { value: 1 }, uYSign: { value: normalYSign },
    },
    depthTest: false, depthWrite: false, blending: CustomBlending,
  });
  material.blendEquation = AddEquation;
  if (kind === 'override') {
    material.blendSrc = OneFactor; // premultiplied "over": the copy, then what was there times what the copy lets through
    material.blendDst = OneMinusSrcAlphaFactor;
    material.blendSrcAlpha = OneFactor;
    material.blendDstAlpha = OneMinusSrcAlphaFactor;
  } else {
    material.blendSrc = SrcAlphaFactor;
    material.blendDst = OneMinusSrcAlphaFactor;
    material.blendSrcAlpha = ZeroFactor; // the destination alpha is kept, as for stamps
    material.blendDstAlpha = OneFactor;
  }
  material.blendEquationAlpha = AddEquation;
  return material;
}
