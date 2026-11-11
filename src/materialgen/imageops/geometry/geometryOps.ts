import { Vector4, type IUniform, type Texture } from 'three';
import type { EditMapKind } from '../filters/editControls';
import type { GpuContext } from '../gpu/gpuContext';
import { fromRgba, toRgba, type PixelImage } from '../gpu/pixelFormats';
import type { CropRect } from './cropRect';
import { MIRROR_FRAGMENT, RESAMPLE_FRAGMENT, TILE_FRAGMENT } from './geometryShaders';
import { QUADRANTS, type MirrorPlan } from './mirrorPlan';
import type { TilingSettings } from './tilingBake';

// Imageops R24-R40: the multi-map geometry ops, one map at a time through one result target (R13). Each returns the stored form of the map.

export interface MapInput {
  image: PixelImage;
  kind: EditMapKind;
}

const MAX_TAPS = 16;

export class ImageTooLargeError extends Error {
  constructor() {
    super('Image is too large for this graphics card.');
  }
}

async function renderToPixels(
  ctx: GpuContext,
  input: MapInput,
  size: number,
  options: { decodeSrgb: boolean; nearest: boolean },
  fragment: string,
  uniforms: (source: Texture) => Record<string, IUniform>,
): Promise<PixelImage> {
  const { image } = input;
  const limit = ctx.maxTextureSize();
  if (image.width > limit || image.height > limit || size > limit) throw new ImageTooLargeError();
  const source = ctx.upload(toRgba(image), image.width, image.height, options);
  const lease = ctx.pool.acquire('rgba8', size, size);
  const pass = ctx.createPass(fragment, uniforms(source));
  try {
    ctx.run(pass, lease.target);
    return fromRgba(await ctx.read(lease.target), size, size, image.channels === 1 ? 1 : 3);
  } finally {
    ctx.releasePass(pass);
    lease.release();
    source.dispose();
  }
}

const number = (value: number): IUniform => ({ value });

/** R32-R35: the result's quadrants copy the plan's source quadrants, exactly, with the matching normal component flipped. */
export function mirrorMap(ctx: GpuContext, input: MapInput, plan: MirrorPlan): Promise<PixelImage> {
  const size = input.image.width;
  const planUniform = QUADRANTS.map((quadrant) => {
    const { from, flipX, flipY } = plan[quadrant];
    return new Vector4(QUADRANTS.indexOf(from), flipX ? 1 : 0, flipY ? 1 : 0, 0);
  });
  return renderToPixels(ctx, input, size, { decodeSrgb: false, nearest: true }, MIRROR_FRAGMENT, (source) => ({
    uSource: { value: source }, uSize: number(size), uPlan: { value: planUniform }, uNormal: { value: input.kind === 'normal' },
  }));
}

function tiledPass(ctx: GpuContext, input: MapInput, tiling: TilingSettings, exact: boolean): Promise<PixelImage> {
  const size = input.image.width;
  const shrinks = !exact && (tiling.tx > 1 || tiling.ty > 1);
  return renderToPixels(ctx, input, size, { decodeSrgb: input.kind === 'albedo' && !exact, nearest: exact }, TILE_FRAGMENT, (source) => ({
    uSource: { value: source },
    uSize: number(size),
    uTiles: { value: { x: tiling.tx, y: tiling.ty } },
    uOffset: { value: { x: tiling.ox, y: tiling.oy } },
    uTaps: { value: { x: exact ? 1 : tiling.tx, y: exact ? 1 : tiling.ty } },
    uNormal: { value: shrinks && input.kind === 'normal' },
    uEncodeSrgb: { value: input.kind === 'albedo' && !exact },
  }));
}

/** R36: out(x, y) = in((x + S/2) mod S, (y + S/2) mod S), exactly. */
export const swapDiagonals = (ctx: GpuContext, input: MapInput): Promise<PixelImage> => tiledPass(ctx, input, { tx: 1, ty: 1, ox: 0.5, oy: 0.5 }, true);

/** R37, R38: out(uv) = in(fract(uv * t + o)) at the same size, each repeat prefiltered by the box of source texels it covers. */
export const bakeTiling = (ctx: GpuContext, input: MapInput, tiling: TilingSettings): Promise<PixelImage> => tiledPass(ctx, input, tiling, false);

/** R24, R26, R27, R30: `rect` of the image scaled to size x size (each axis on its own). */
export function scaleRectToSquare(ctx: GpuContext, input: MapInput, rect: CropRect, size: number): Promise<PixelImage> {
  const { image } = input;
  const whole = rect.x === 0 && rect.y === 0 && rect.width === image.width && rect.height === image.height;
  const taps = (side: number): number => Math.min(MAX_TAPS, side / size > 2 ? Math.ceil(side / size) : 1);
  const albedo = input.kind === 'albedo';
  return renderToPixels(ctx, input, size, { decodeSrgb: albedo, nearest: false }, RESAMPLE_FRAGMENT, (source) => ({
    uSource: { value: source },
    uSourceSize: { value: { x: image.width, y: image.height } },
    uRect: { value: { x: rect.x, y: rect.y, z: rect.width, w: rect.height } },
    uSize: number(size),
    uTaps: { value: { x: taps(rect.width), y: taps(rect.height) } },
    uWrap: { value: whole },
    uNormal: { value: input.kind === 'normal' },
    uEncodeSrgb: { value: albedo },
  }));
}
