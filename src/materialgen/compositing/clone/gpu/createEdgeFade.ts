import { LinearFilter, Mesh, NoColorSpace, OrthographicCamera, PlaneGeometry, RedFormat, RepeatWrapping, Scene, UnsignedByteType, WebGLRenderer, WebGLRenderTarget, type ShaderMaterial, type Texture } from 'three';
import { withRendererState } from '../../gpu/withRendererState';
import type { LiftRect } from '../plan/highlightBounds';
import { createBlurMaterial } from './cloneShaders';

export interface EdgeFade {
  /**
   * The highlight over the lifted rectangle, blurred by a box of `radius` texels (clone R10): 0 at `radius` outside the painted edge, 1 at `radius` inside it, the
   * painted edge itself where `radius` is 0. Two passes, O(w x h x radius). The returned texture is valid until the next call.
   */
  compute(mask: Texture, side: number, rect: LiftRect, radius: number): Texture;
  texture(): Texture | null;
  /** Frees the fade and the blur's intermediate. */
  release(): void;
  dispose(): void;
}

const makeTarget = (width: number, height: number, repeat: boolean): WebGLRenderTarget => {
  const target = new WebGLRenderTarget(width, height, {
    depthBuffer: false, generateMipmaps: false, minFilter: LinearFilter, magFilter: LinearFilter,
    wrapS: repeat ? RepeatWrapping : RepeatWrapping, wrapT: RepeatWrapping, format: RedFormat, type: UnsignedByteType,
  });
  target.texture.colorSpace = NoColorSpace;
  return target;
};

/** Clone R10, C4: the soft edge of the copy, a separable box blur of the highlight's alpha into an R8 target of the lifted rectangle's size. */
export function createEdgeFade(renderer: WebGLRenderer): EdgeFade {
  const camera = new OrthographicCamera(-1, 1, 1, -1, 0, 1);
  const scene = new Scene();
  const quadGeometry = new PlaneGeometry(1, 1);
  const quad = new Mesh(quadGeometry);
  quad.frustumCulled = false;
  scene.add(quad);
  let blur: WebGLRenderTarget | null = null;
  let fade: WebGLRenderTarget | null = null;
  const materials: ShaderMaterial[] = [];

  const release = (): void => {
    blur?.dispose();
    blur = null;
    fade?.dispose();
    fade = null;
    for (const material of materials) material.dispose();
    materials.length = 0;
  };

  return {
    compute(mask, side, rect, radius) {
      if (fade === null || fade.width !== rect.w || fade.height !== rect.h) {
        release();
        blur = makeTarget(rect.w, rect.h, true);
        fade = makeTarget(rect.w, rect.h, true);
      }
      const intermediate = blur!;
      const output = fade;
      return withRendererState(renderer, () => {
        renderer.autoClear = false;
        const pass = (source: Texture, origin: [number, number], size: [number, number], axis: [number, number], into: WebGLRenderTarget): void => {
          const material = createBlurMaterial(source);
          material.uniforms['uOrigin']!.value = origin;
          material.uniforms['uSourceSize']!.value = size;
          material.uniforms['uAxis']!.value = axis;
          material.uniforms['uRadius']!.value = radius;
          quad.material = material;
          renderer.setRenderTarget(into);
          renderer.render(scene, camera);
          material.dispose();
        };
        pass(mask, [rect.x, rect.y], [side, side], [1, 0], intermediate); // the picture's highlight, cropped and blurred along x
        pass(intermediate.texture, [0, 0], [rect.w, rect.h], [0, 1], output); // then along y
        return output.texture;
      });
    },
    texture: () => fade?.texture ?? null,
    release,
    dispose() {
      release();
      quadGeometry.dispose();
    },
  };
}
