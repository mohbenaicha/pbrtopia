import { Vector2, Vector3, Vector4, type IUniform, type ShaderMaterial, type Texture, type WebGLRenderTarget } from 'three';
import type { GpuContext } from '../gpu/gpuContext';
import type { RtLease } from '../gpu/rtPool';
import { fromRgba, toRgba, type PixelImage } from '../gpu/pixelFormats';
import type { EditMapKind, EditValues } from './editControls';
import { SPATIAL_FRAGMENT, TONE_FRAGMENT } from './filterShaders';
import { computeLumaRange, type LumaRange } from './lumaRange';
import type { OpSession } from '../session/opSession';
import { planSpatialPasses, type SpatialMode } from './spatialPlan';
import { buildToneUniforms } from './toneUniforms';

// Imageops R1-R3, R7, R13, R18-R21: one filter session on one map. It owns the source texture and, from the first render, at most one result
// target and two intermediate targets (all from the pool), and gives them back on close.

export const MAX_PREVIEW_SIZE = 1024;

export type FilterSession = OpSession<EditValues>;

export interface FilterSessionOptions {
  image: PixelImage; // the working copy, S x S
  kind: EditMapKind;
  previewSize?: number; // P; min(S, 1024) by default
  albedo?: PixelImage; // a normal map's colour mixin reads it (R82-R84); any size, sampled by uv; without it the mixin does nothing
}

const MODE_INDEX: Record<SpatialMode, number> = { blur: 0, denoise: 1, sharpness: 2, highpass: 3, clarity: 4, edge: 5, scale: 6, mix: 7 };

const vec2 = (v: [number, number]): Vector2 => new Vector2(v[0], v[1]);
const vec3 = (v: [number, number, number]): Vector3 => new Vector3(v[0], v[1], v[2]);
const vec4 = (v: [number, number, number, number]): Vector4 => new Vector4(v[0], v[1], v[2], v[3]);

export function createFilterSession(ctx: GpuContext, { image, kind, previewSize, albedo }: FilterSessionOptions): FilterSession {
  const size = image.width;
  const preview = previewSize ?? Math.min(size, MAX_PREVIEW_SIZE);
  const source: Texture = ctx.upload(toRgba(image), size, size, { decodeSrgb: kind === 'albedo' });
  const albedoTexture: Texture | null = kind === 'normal' && albedo !== undefined ? ctx.upload(toRgba(albedo), albedo.width, albedo.height, { decodeSrgb: true }) : null; // R84: owned here, released on close
  const channels = kind === 'albedo' || kind === 'normal' ? 3 : 1;
  let range: LumaRange | null = null;
  let result: { lease: RtLease<WebGLRenderTarget>; size: number } | null = null;
  let middle: { leases: [RtLease<WebGLRenderTarget>, RtLease<WebGLRenderTarget>]; size: number } | null = null;
  let spatialPass: ShaderMaterial | null = null;
  let tonePass: ShaderMaterial | null = null;
  let closed = false;

  const resultTarget = (at: number): WebGLRenderTarget => {
    if (result?.size !== at) {
      result?.lease.release();
      result = { lease: ctx.pool.acquire('rgba8', at, at), size: at };
    }
    return result.lease.target;
  };
  const middleTargets = (at: number): [WebGLRenderTarget, WebGLRenderTarget] => {
    if (middle?.size !== at) {
      middle?.leases.forEach((lease) => lease.release());
      middle = { leases: [ctx.pool.acquire('rgba16f', at, at), ctx.pool.acquire('rgba16f', at, at)], size: at };
    }
    return [middle.leases[0].target, middle.leases[1].target];
  };

  async function render(values: EditValues, at: number): Promise<PixelImage> {
    if (closed) throw new Error('The filter session is closed.');
    const plan = planSpatialPasses(kind, values).filter((pass) => pass.mode !== 'mix' || albedoTexture !== null);
    if (range === null) range = computeLumaRange(image, kind); // once per session, shared by preview and Apply (R20)
    const tone = buildToneUniforms(kind, values, range);
    let current: Texture = source;
    if (plan.length > 0) {
      const targets = middleTargets(at);
      spatialPass ??= ctx.createPass(SPATIAL_FRAGMENT, {
        uSource: { value: null }, uMode: { value: 0 }, uAmount: { value: 0 }, uBands: { value: new Vector3(1, 1, 1) },
        uTexelsToUv: { value: 1 / size }, uPassTexel: { value: new Vector2() }, uNormal: { value: false },
        uAlbedoTex: { value: albedoTexture ?? source },
      });
      plan.forEach((pass, index) => {
        const target = targets[index % 2]!;
        const uniforms = spatialPass!.uniforms as Record<string, IUniform>;
        uniforms['uSource']!.value = current;
        uniforms['uMode']!.value = MODE_INDEX[pass.mode];
        uniforms['uAmount']!.value = pass.amount;
        uniforms['uBands']!.value = pass.bands ? vec3(pass.bands) : new Vector3(1, 1, 1);
        uniforms['uPassTexel']!.value = new Vector2(1 / at, 1 / at);
        uniforms['uNormal']!.value = kind === 'normal';
        ctx.run(spatialPass!, target); // a pass never samples the target it writes: they alternate (R3)
        current = target.texture;
      });
    }
    const target = resultTarget(at);
    tonePass ??= ctx.createPass(TONE_FRAGMENT, {
      uSource: { value: null }, uAlbedo: { value: false }, uGrey: { value: false }, uNormalizeRange: { value: new Vector2() }, uLevels: { value: new Vector3() },
      uExposure: { value: new Vector4() }, uTone: { value: new Vector4() }, uShape: { value: new Vector4() }, uColorA: { value: new Vector4() }, uColorB: { value: new Vector2() },
    });
    const uniforms = tonePass.uniforms as Record<string, IUniform>;
    uniforms['uSource']!.value = current;
    uniforms['uAlbedo']!.value = tone.albedo;
    uniforms['uGrey']!.value = tone.grey;
    uniforms['uNormalizeRange']!.value = vec2(tone.normalizeRange);
    uniforms['uLevels']!.value = vec3(tone.levels);
    uniforms['uExposure']!.value = vec4(tone.exposure);
    uniforms['uTone']!.value = vec4(tone.tone);
    uniforms['uShape']!.value = vec4(tone.shape);
    uniforms['uColorA']!.value = vec4(tone.colorA);
    uniforms['uColorB']!.value = vec2(tone.colorB);
    ctx.run(tonePass, target);
    return fromRgba(await ctx.read(target), at, at, channels);
  }

  return {
    size,
    previewSize: preview,
    renderPreview: (values) => render(values, preview),
    renderFinal: (values) => render(values, size),
    close() {
      if (closed) return;
      closed = true;
      result?.lease.release();
      middle?.leases.forEach((lease) => lease.release());
      result = null;
      middle = null;
      if (spatialPass) ctx.releasePass(spatialPass);
      if (tonePass) ctx.releasePass(tonePass);
      source.dispose();
      albedoTexture?.dispose();
    },
  };
}
