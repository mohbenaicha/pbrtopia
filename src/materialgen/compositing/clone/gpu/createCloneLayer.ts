import {
  LinearFilter, LinearMipmapLinearFilter, ClampToEdgeWrapping, Mesh, NoColorSpace, OrthographicCamera, PlaneGeometry, RGBAFormat, Scene, SRGBColorSpace, UnsignedByteType,
  WebGLRenderer, WebGLRenderTarget, type ShaderMaterial, type Texture,
} from 'three';
import { rebuildMipmapsOf } from '../../gpu/rawGl';
import type { StampPainter } from '../../gpu/createStampPainter';
import { withRendererState } from '../../gpu/withRendererState';
import type { LiftRect } from '../plan/highlightBounds';
import { createColourCaptureMaterial, createNormalCaptureMaterial, createSurfaceCaptureMaterial } from './cloneShaders';

/** The lifted rectangle (clone R8): a snapshot of the picture's maps over it, frozen at the moment of the lift. */
export interface CloneLayer {
  readonly rect: LiftRect;
  /** The albedo as stored (sRGB), real colour everywhere in the rectangle. */
  readonly colour: Texture;
  /** r = height (0 without a height map), g = roughness, b = metal. */
  readonly surface: Texture;
  /** The composed normal, OpenGL or DirectX as stored, z floored; null while the picture has no normal map. */
  readonly normal: Texture | null;
  readonly hasHeight: boolean;
  dispose(): void;
}

const makeLayerTarget = (rect: LiftRect, colourSpace: typeof SRGBColorSpace | typeof NoColorSpace): WebGLRenderTarget => {
  const target = new WebGLRenderTarget(rect.w, rect.h, {
    depthBuffer: false, generateMipmaps: true, minFilter: LinearMipmapLinearFilter, magFilter: LinearFilter,
    wrapS: ClampToEdgeWrapping, wrapT: ClampToEdgeWrapping, format: RGBAFormat, type: UnsignedByteType,
  });
  target.texture.colorSpace = colourSpace;
  return target;
};

/**
 * Clone R8, R14, architecture C4: copies the maps over `rect` (unwrapped texels, the picture repeats) into three layer targets, two or three passes of O(w x h), then
 * builds their mipmaps once so a shrunk copy does not alias. The caller has drained pending stamps, so the maps are what the user sees.
 */
export function createCloneLayer(renderer: WebGLRenderer, painter: StampPainter, rect: LiftRect): CloneLayer {
  const camera = new OrthographicCamera(-1, 1, 1, -1, 0, 1);
  const scene = new Scene();
  const geometry = new PlaneGeometry(1, 1);
  const quad = new Mesh(geometry);
  quad.frustumCulled = false;
  scene.add(quad);

  const hasHeight = painter.hasMap('height');
  const hasNormal = painter.hasMap('normal');
  const colour = makeLayerTarget(rect, SRGBColorSpace);
  const surface = makeLayerTarget(rect, NoColorSpace);
  const normal = hasNormal ? makeLayerTarget(rect, NoColorSpace) : null;
  const targets = [colour, surface, ...(normal === null ? [] : [normal])];

  withRendererState(renderer, () => {
    renderer.autoClear = false;
    const pass = (material: ShaderMaterial, into: WebGLRenderTarget): void => {
      material.uniforms['uOrigin']!.value = [rect.x, rect.y];
      material.uniforms['uSide']!.value = painter.side;
      quad.material = material;
      renderer.setRenderTarget(into);
      renderer.render(scene, camera);
      material.dispose();
    };
    pass(createColourCaptureMaterial(painter.texture('albedo')), colour);
    pass(createSurfaceCaptureMaterial(painter.texture('orm'), hasHeight ? painter.texture('height') : null), surface);
    if (normal !== null) pass(createNormalCaptureMaterial(painter.texture('normal')), normal);
    for (const target of targets) {
      rebuildMipmapsOf(renderer, target.texture);
      target.texture.generateMipmaps = false; // the layer is never drawn into again
    }
  });
  geometry.dispose();

  return {
    rect,
    colour: colour.texture,
    surface: surface.texture,
    normal: normal === null ? null : normal.texture,
    hasHeight,
    dispose: () => { for (const target of targets) target.dispose(); },
  };
}
