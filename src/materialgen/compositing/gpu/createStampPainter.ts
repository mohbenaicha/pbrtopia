import {
  ClampToEdgeWrapping, DataTexture, HalfFloatType, LinearFilter, LinearMipmapLinearFilter, Mesh, NearestFilter,
  NoColorSpace, OrthographicCamera, PlaneGeometry, RedFormat, RepeatWrapping, RGBAFormat, RGFormat, Scene, ShaderMaterial, SRGBColorSpace, UnsignedByteType,
  WebGLRenderer, WebGLRenderTarget, type Texture,
} from 'three';
import { wrapInstances } from '../plan/wrapInstances';
import type { Stamp } from '../plan/planStamps';
import { createInstancedQuad, INSTANCES_PER_DRAW, setInstanceCount } from './createInstancedQuad';
import { DEFAULT_MAP_BYTES, toLinearColour, type PaintMaterial } from './paintMaterial';
import { flipRows, rebuildMipmapsOf, uploadPictureBytes } from './rawGl';
import { createComposeMaterial, createRedCopyMaterial, createStampMaterial } from './stampShaders';
import { shapeFlagOf, stampBounds, tileRect, unionRect, type AtlasGrid, type TexelRect } from './stampGeometry';
import { withRendererState } from './withRendererState';

/** Compositing R19: the tilt added per unit of stamp-local coverage slope. Tunable by eye (T3 value). */
export const EDGE_BURN_GAIN = 0.75; // compositing R76: the tilt of a crisp edge (the coverage changes by 1 across the baseline)
const BOUNDS_MARGIN = 2;

export type MapKind = 'albedo' | 'orm' | 'height' | 'normal';
/**
 * The targets an edit changes and the journal saves (A6); the composed normal is recomposed from `slope` and `override`, never saved. `override` (clone R15) holds the
 * normals a placement copied, premultiplied, with the coverage in alpha.
 */
export type JournalKind = 'albedo' | 'orm' | 'height' | 'slope' | 'override';
/** Called once per paint call, before any draw, with the texel rectangle and the targets about to change. */
export type BeforeDraw = (rect: TexelRect, kinds: readonly JournalKind[]) => void;
type Bytes = Uint8Array<ArrayBuffer>;

/** What one paint call writes (R17-R19). Height `replace`: the target height 0-1 (R18: 0.5 + level / 2); `add`: the signed change 0-1 (level / 2). */
export interface PaintSettings {
  material: PaintMaterial;
  height: { mode: 'replace' | 'add'; value: number } | null;
  edgeBurn: { direction: 'raise' | 'dent'; width: number } | null; // width in target texels (R77)
}

/** Starting maps in picture order (row 0 is the top): albedo RGBA, orm RGBA, height one byte, normal RGBA. A missing one starts flat (R20). */
export interface PainterMaps {
  albedo?: Bytes;
  orm?: Bytes;
  height?: Bytes;
  normal?: Bytes;
}

export interface StampPainterOptions {
  side: number;
  atlas: { data: Bytes; width: number; height: number }; // one R8 image holding every shape tile
  grid: AtlasGrid;
  maps: PainterMaps;
  normalDirection: 'opengl' | 'directx';
}

/**
 * Compositing A4: paints stamps onto four maps on a renderer someone else owns. Rectangles are in texture rows (y0 is the bottom row), the space the GPU and the
 * raw tile copies work in; `readBytes` returns picture order. Mipmaps of albedo and normal are rebuilt only on request (A4.1).
 */
export interface StampPainter {
  /** Paint the stamps in order onto the maps the settings name; the texel rectangle that may have changed, or null for no stamps. */
  paint(stamps: readonly Stamp[], settings: PaintSettings): TexelRect | null;
  readBytes(kind: MapKind): Uint8Array;
  /** The height map reduced to `side` x `side` bytes (texture rows, v up), or null while there is none (R26). */
  readHeightProxy(side: number): Uint8Array | null;
  texture(kind: MapKind): Texture;
  rebuildMipmaps(): void;
  readonly side: number;
  /** The shape atlas on the GPU, so the ghost draws from the same texture (A5). */
  readonly atlas: Texture;
  /** The live target of a journaled map, or null while it does not exist yet (height, slope and override are made on first use). */
  journalTarget(kind: JournalKind): WebGLRenderTarget | null;
  /** Clone R14: whether the map exists, given by the project or made by a stamp or a placement; a map that does not exist is never created by merely looking. */
  hasMap(kind: MapKind): boolean;
  /** Makes the journaled targets exist (before the journal records them, so Undo can restore them). `override` needs the composed normal, so it makes `slope` too. */
  ensureTargets(kinds: readonly JournalKind[]): void;
  /** The stored normal map, as the compose pass reads it; null until the composed normal exists. */
  baseNormalTexture(): Texture | null;
  /** -1 for DirectX normal maps: the y channel as stored is the OpenGL y times this. */
  readonly normalYSign: 1 | -1;
  /** Recompose the normal over a rectangle from the stored normal and the slope (after the journal restored slope tiles). */
  recomposeNormal(rect: TexelRect): void;
  setBeforeDraw(hook: BeforeDraw | null): void;
  dispose(): void;
}

const CHANNELS: Record<MapKind, 1 | 4> = { albedo: 4, orm: 4, height: 1, normal: 4 };

function flatBytes(side: number, pattern: readonly number[]): Bytes {
  const out = new Uint8Array(side * side * pattern.length);
  for (let index = 0; index < side * side; index += 1) out.set(pattern, index * pattern.length);
  return out;
}

export function createStampPainter(renderer: WebGLRenderer, options: StampPainterOptions): StampPainter {
  const { side, grid, normalDirection } = options;
  const texel = 1 / side;
  const normalYSign: 1 | -1 = normalDirection === 'directx' ? -1 : 1;
  const camera = new OrthographicCamera(-1, 1, 1, -1, 0, 1);

  const atlas = new DataTexture(options.atlas.data, options.atlas.width, options.atlas.height, RedFormat, UnsignedByteType);
  atlas.minFilter = LinearFilter;
  atlas.magFilter = LinearFilter;
  atlas.wrapS = ClampToEdgeWrapping;
  atlas.wrapT = ClampToEdgeWrapping;
  atlas.generateMipmaps = false;
  atlas.unpackAlignment = 1;
  atlas.needsUpdate = true;

  const stampMaterials = {
    albedo: createStampMaterial('mix', atlas, texel),
    orm: createStampMaterial('mix', atlas, texel),
    heightMix: createStampMaterial('mix', atlas, texel),
    heightAdd: createStampMaterial('add', atlas, texel),
    heightSubtract: createStampMaterial('subtract', atlas, texel),
    slope: createStampMaterial('slope', atlas, texel),
  };
  const stampScene = new Scene();
  const instances = createInstancedQuad();
  stampScene.add(instances.mesh);
  const screenScene = new Scene();
  const screenQuadGeometry = new PlaneGeometry(1, 1);
  const screenQuad = new Mesh(screenQuadGeometry);
  screenQuad.frustumCulled = false;
  screenScene.add(screenQuad);

  const makeTarget = (kind: 'albedo' | 'orm' | 'height' | 'slope' | 'composed' | 'override'): WebGLRenderTarget => {
    const mips = kind === 'albedo' || kind === 'composed';
    const target = new WebGLRenderTarget(side, side, {
      depthBuffer: false,
      generateMipmaps: mips, // allocates the levels; switched off once the storage exists so three does not rebuild them after every draw (A4.1)
      minFilter: mips ? LinearMipmapLinearFilter : LinearFilter,
      magFilter: LinearFilter,
      wrapS: RepeatWrapping,
      wrapT: RepeatWrapping,
      format: kind === 'height' ? RedFormat : kind === 'slope' ? RGFormat : RGBAFormat,
      type: kind === 'slope' ? HalfFloatType : UnsignedByteType,
    });
    target.texture.colorSpace = kind === 'albedo' ? SRGBColorSpace : NoColorSpace;
    return target;
  };

  const initialBytes = (kind: MapKind): Bytes => options.maps[kind] ?? flatBytes(side, DEFAULT_MAP_BYTES[kind]);
  const filledTarget = (kind: 'albedo' | 'orm' | 'height'): WebGLRenderTarget => {
    const target = makeTarget(kind);
    uploadPictureBytes(renderer, target, initialBytes(kind), CHANNELS[kind]);
    if (target.texture.generateMipmaps) { rebuildMipmapsOf(renderer, target.texture); target.texture.generateMipmaps = false; }
    return target;
  };

  const [albedoTarget, ormTarget] = withRendererState(renderer, () => [filledTarget('albedo'), filledTarget('orm')] as const);
  let heightTarget: WebGLRenderTarget | null = null;
  let slopeTarget: WebGLRenderTarget | null = null;
  let composedTarget: WebGLRenderTarget | null = null;
  let overrideTarget: WebGLRenderTarget | null = null;
  let baseNormal: DataTexture | null = null;
  const noOverride = new DataTexture(new Uint8Array(4), 1, 1, RGBAFormat, UnsignedByteType); // until a placement copies a normal, the compose pass reads this transparent texel
  noOverride.needsUpdate = true;
  let beforeDraw: BeforeDraw | null = null;
  let composeMaterial: ShaderMaterial | null = null;

  const ensureHeight = (): WebGLRenderTarget => (heightTarget ??= filledTarget('height'));

  const draw = (scene: Scene, target: WebGLRenderTarget): void => {
    renderer.setRenderTarget(target);
    renderer.render(scene, camera);
  };
  const drawScreen = (material: ShaderMaterial, target: WebGLRenderTarget): void => {
    screenQuad.material = material;
    draw(screenScene, target);
  };

  const ensureSlope = (): { slope: WebGLRenderTarget; composed: WebGLRenderTarget } => {
    if (slopeTarget !== null && composedTarget !== null && composeMaterial !== null) return { slope: slopeTarget, composed: composedTarget };
    slopeTarget = makeTarget('slope');
    renderer.setRenderTarget(slopeTarget);
    renderer.setClearColor(0x000000, 0);
    renderer.clear();
    baseNormal = new DataTexture(initialBytes('normal'), side, side, RGBAFormat, UnsignedByteType);
    baseNormal.flipY = true; // picture order in, texture rows out
    baseNormal.minFilter = NearestFilter;
    baseNormal.magFilter = NearestFilter;
    baseNormal.generateMipmaps = false;
    baseNormal.unpackAlignment = 1;
    baseNormal.needsUpdate = true;
    composedTarget = makeTarget('composed');
    composeMaterial = createComposeMaterial(baseNormal, slopeTarget.texture, overrideTarget === null ? noOverride : overrideTarget.texture, normalYSign);
    drawScreen(composeMaterial, composedTarget); // the composed normal starts as the stored one (the slope is zero everywhere)
    rebuildMipmapsOf(renderer, composedTarget.texture);
    composedTarget.texture.generateMipmaps = false;
    return { slope: slopeTarget, composed: composedTarget };
  };

  const ensureOverride = (): WebGLRenderTarget => {
    ensureSlope();
    if (overrideTarget !== null) return overrideTarget;
    overrideTarget = makeTarget('override');
    renderer.setRenderTarget(overrideTarget);
    renderer.setClearColor(0x000000, 0);
    renderer.clear();
    composeMaterial!.uniforms['uOverride']!.value = overrideTarget.texture;
    return overrideTarget;
  };

  const ensureTargets = (kinds: readonly JournalKind[]): void => withRendererState(renderer, () => {
    for (const kind of kinds) {
      if (kind === 'height') ensureHeight();
      else if (kind === 'slope') ensureSlope();
      else if (kind === 'override') ensureOverride();
    }
  });

  const composeOver = (rect: TexelRect): void => {
    const { composed } = ensureSlope();
    composed.scissor.set(rect.x0, rect.y0, rect.x1 - rect.x0, rect.y1 - rect.y0);
    composed.scissorTest = true;
    drawScreen(composeMaterial!, composed);
    composed.scissorTest = false;
  };

  const paint = (stamps: readonly Stamp[], settings: PaintSettings): TexelRect | null => {
    if (stamps.length === 0) return null;
    return withRendererState(renderer, () => {
      const gl = renderer.getContext() as WebGL2RenderingContext;
      renderer.autoClear = false;
      const slope = settings.edgeBurn === null ? null : ensureSlope().slope;
      const height = settings.height === null ? null : ensureHeight();

      const [red, green, blue] = toLinearColour(settings.material.albedo);
      stampMaterials.albedo.uniforms['uValue']!.value = [red, green, blue, 0];
      stampMaterials.orm.uniforms['uValue']!.value = [0, settings.material.roughness / 255, settings.material.metalness / 255, 0];
      let heightMaterial: ShaderMaterial | null = null;
      if (settings.height !== null) {
        heightMaterial = settings.height.mode === 'replace' ? stampMaterials.heightMix : settings.height.value >= 0 ? stampMaterials.heightAdd : stampMaterials.heightSubtract;
        heightMaterial.uniforms['uValue']!.value = [settings.height.mode === 'replace' ? settings.height.value : Math.abs(settings.height.value), 0, 0, 0];
      }
      if (settings.edgeBurn !== null) {
        stampMaterials.slope.uniforms['uGain']!.value = (settings.edgeBurn.direction === 'raise' ? 1 : -1) * EDGE_BURN_GAIN;
        stampMaterials.slope.uniforms['uWidth']!.value = settings.edgeBurn.width;
      }

      const drawInstances = (count: number): void => {
        setInstanceCount(instances, count);
        const drawWith = (material: ShaderMaterial, target: WebGLRenderTarget): void => { instances.mesh.material = material; draw(stampScene, target); };
        drawWith(stampMaterials.albedo, albedoTarget);
        gl.colorMask(false, true, true, false); // roughness and metal only: the packed texture's AO channel is never written (R17)
        drawWith(stampMaterials.orm, ormTarget);
        gl.colorMask(true, true, true, true);
        if (heightMaterial !== null && height !== null) drawWith(heightMaterial, height);
        if (slope !== null) drawWith(stampMaterials.slope, slope);
      };

      let count = 0;
      let rect: TexelRect | null = null;
      for (const stamp of stamps) rect = unionRect(rect, stampBounds(stamp, side, BOUNDS_MARGIN));
      if (rect !== null && beforeDraw !== null) {
        const kinds: JournalKind[] = ['albedo', 'orm'];
        if (height !== null) kinds.push('height');
        if (slope !== null) kinds.push('slope');
        beforeDraw(rect, kinds); // A6: the tiles about to change are saved before this frame's draws
      }
      for (const stamp of stamps) {
        const { u0, v0, du, dv } = tileRect(grid, Math.max(stamp.shape, 0)); // the square (R43) samples nothing, so any tile will do
        const shapeFlag = shapeFlagOf(stamp);
        for (const centre of wrapInstances({ x: stamp.x, y: stamp.y, size: stamp.size })) {
          instances.place.set([centre.x, centre.y, stamp.size, stamp.angle], count * 4);
          instances.tile.set([u0, v0, du, dv], count * 4);
          instances.brush.set([stamp.strength, stamp.hardness, shapeFlag, 0], count * 4);
          count += 1;
          if (count === INSTANCES_PER_DRAW) { drawInstances(count); count = 0; }
        }
      }
      if (count > 0) drawInstances(count);
      if (settings.edgeBurn !== null && rect !== null) composeOver(rect);
      return rect;
    });
  };

  const readColour = (target: WebGLRenderTarget): Uint8Array => {
    const out = new Uint8Array(side * side * 4);
    renderer.readRenderTargetPixels(target, 0, 0, side, side, out);
    return flipRows(out, side, 4);
  };

  const readBytes = (kind: MapKind): Uint8Array => withRendererState(renderer, () => {
    if (kind === 'albedo') return readColour(albedoTarget);
    if (kind === 'orm') return readColour(ormTarget);
    if (kind === 'normal') return composedTarget === null ? initialBytes('normal').slice() : readColour(composedTarget);
    if (heightTarget === null) return initialBytes('height').slice();
    const copy = makeTarget('orm'); // RGBA8, plain bytes
    const material = createRedCopyMaterial(heightTarget.texture);
    drawScreen(material, copy);
    const rgba = readColour(copy);
    copy.dispose();
    material.dispose();
    const out = new Uint8Array(side * side);
    for (let index = 0; index < out.length; index += 1) out[index] = rgba[index * 4]!;
    return out;
  });

  const texture = (kind: MapKind): Texture => withRendererState(renderer, () => {
    if (kind === 'albedo') return albedoTarget.texture;
    if (kind === 'orm') return ormTarget.texture;
    if (kind === 'height') return ensureHeight().texture;
    return ensureSlope().composed.texture;
  });

  // R26: the height as a small picture (texture rows, v up) for the surface pick; nothing before the height map exists.
  let proxyTarget: WebGLRenderTarget | null = null;
  let proxyMaterial: ShaderMaterial | null = null;
  const readHeightProxy = (proxySide: number): Uint8Array | null => withRendererState(renderer, () => {
    if (heightTarget === null) return null;
    if (proxyTarget === null || proxyTarget.width !== proxySide) {
      proxyTarget?.dispose();
      proxyTarget = new WebGLRenderTarget(proxySide, proxySide, { depthBuffer: false, minFilter: LinearFilter, magFilter: LinearFilter });
      proxyTarget.texture.colorSpace = NoColorSpace;
    }
    proxyMaterial ??= createRedCopyMaterial(heightTarget.texture);
    drawScreen(proxyMaterial, proxyTarget);
    const rgba = new Uint8Array(proxySide * proxySide * 4);
    renderer.readRenderTargetPixels(proxyTarget, 0, 0, proxySide, proxySide, rgba);
    const out = new Uint8Array(proxySide * proxySide);
    for (let index = 0; index < out.length; index += 1) out[index] = rgba[index * 4]!;
    return out;
  });

  return {
    paint,
    readBytes,
    readHeightProxy,
    texture,
    side,
    atlas,
    journalTarget: (kind) => (kind === 'albedo' ? albedoTarget : kind === 'orm' ? ormTarget : kind === 'height' ? heightTarget : kind === 'slope' ? slopeTarget : overrideTarget),
    hasMap: (kind) => (kind === 'albedo' || kind === 'orm' ? true : kind === 'height' ? options.maps.height !== undefined || heightTarget !== null : options.maps.normal !== undefined || slopeTarget !== null),
    ensureTargets,
    baseNormalTexture: () => baseNormal,
    normalYSign,
    recomposeNormal: (rect) => { if (composedTarget !== null) withRendererState(renderer, () => composeOver(rect)); },
    setBeforeDraw: (hook) => { beforeDraw = hook; },
    rebuildMipmaps: () => withRendererState(renderer, () => {
      rebuildMipmapsOf(renderer, albedoTarget.texture);
      if (composedTarget !== null) rebuildMipmapsOf(renderer, composedTarget.texture);
    }),
    dispose: () => {
      for (const target of [albedoTarget, ormTarget, heightTarget, slopeTarget, composedTarget, overrideTarget, proxyTarget]) target?.dispose();
      noOverride.dispose();
      for (const material of [...Object.values(stampMaterials), composeMaterial, proxyMaterial, screenQuad.material as ShaderMaterial]) material?.dispose();
      atlas.dispose();
      baseNormal?.dispose();
      instances.geometry.dispose();
      screenQuadGeometry.dispose();
    },
  };
}
