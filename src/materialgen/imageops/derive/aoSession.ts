import type { WebGLRenderTarget } from 'three';
import type { GpuContext } from '../gpu/gpuContext';
import { fromRgba, toRgba, type PixelImage } from '../gpu/pixelFormats';
import type { RtLease } from '../gpu/rtPool';
import type { EditValues } from '../filters/editControls';
import type { OpSession } from '../session/opSession';
import { AO_FROM_HEIGHT_FRAGMENT, AO_FROM_NORMAL_FRAGMENT } from './aoShaders';
import { aoControlsFor, type AoSource } from './aoParams';

// Imageops R7, R41-R43: an AO session on a height or normal working copy. Same shape as a filter session; one result target from the pool.

export interface AoSessionOptions {
  image: PixelImage; // the source map, S x S
  source: AoSource;
  previewSize?: number;
}

const MAX_PREVIEW_SIZE = 1024;

export function createAoSession(ctx: GpuContext, { image, source, previewSize }: AoSessionOptions): OpSession<EditValues> {
  const size = image.width;
  const preview = previewSize ?? Math.min(size, MAX_PREVIEW_SIZE);
  const texture = ctx.upload(toRgba(image), size, size);
  const pass = ctx.createPass(source === 'height' ? AO_FROM_HEIGHT_FRAGMENT : AO_FROM_NORMAL_FRAGMENT, {
    uSource: { value: texture }, uSpreadUv: { value: 0 }, uDepth: { value: 0 }, uStrength: { value: 0 }, uPower: { value: 1 }, uBias: { value: 0 },
  });
  const defaults = Object.fromEntries(aoControlsFor(source).map((control) => [control.id, control.defaultValue]));
  let lease: { value: RtLease<WebGLRenderTarget>; size: number } | null = null;
  let closed = false;

  async function render(values: EditValues, at: number): Promise<PixelImage> {
    if (closed) throw new Error('The AO session is closed.');
    if (lease?.size !== at) {
      lease?.value.release();
      lease = { value: ctx.pool.acquire('rgba8', at, at), size: at };
    }
    const v = { ...defaults, ...values };
    const uniforms = pass.uniforms as Record<string, { value: number }>;
    uniforms['uSpreadUv']!.value = v['spread']! / size; // pixels at S, so a preview samples the same footprint (R21)
    uniforms['uDepth']!.value = v['depth'] ?? 0;
    uniforms['uStrength']!.value = v['strength'] ?? 0;
    uniforms['uPower']!.value = v['power'] ?? 1;
    uniforms['uBias']!.value = v['bias'] ?? 0;
    ctx.run(pass, lease.value.target);
    return fromRgba(await ctx.read(lease.value.target), at, at, 1);
  }

  return {
    size,
    previewSize: preview,
    renderPreview: (values) => render(values, preview),
    renderFinal: (values) => render(values, size),
    close() {
      if (closed) return;
      closed = true;
      lease?.value.release();
      lease = null;
      ctx.releasePass(pass);
      texture.dispose();
    },
  };
}
