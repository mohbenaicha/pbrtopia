import { LinearFilter, NoColorSpace, OrthographicCamera, RedFormat, RepeatWrapping, Scene, UnsignedByteType, WebGLRenderer, WebGLRenderTarget, type ShaderMaterial, type Texture } from 'three';
import { createInstancedQuad, INSTANCES_PER_DRAW, setInstanceCount } from '../../gpu/createInstancedQuad';
import { withRendererState } from '../../gpu/withRendererState';
import { wrapInstances } from '../../plan/wrapInstances';
import { createMaskMaterial, type HighlightShape } from './cloneShaders';

/** One highlight stamp: the centre and the side of its square (or the diameter of its disc), in picture fractions. */
export interface MaskStamp { x: number; y: number; size: number }

export interface HighlightMask {
  /** Adds the stamps to the highlight; painting where it already is changes nothing (clone R4). One instanced draw per 512 wrapped copies. */
  paint(stamps: readonly MaskStamp[], shape: HighlightShape): void;
  clear(): void;
  /** The highlight, one byte a texel, repeating; null until something was painted. */
  texture(): Texture | null;
  dispose(): void;
}

/** Clone R4, C4: the highlight as one R8 render target of the picture's size, made on the first stroke. */
export function createHighlightMask(renderer: WebGLRenderer, side: number): HighlightMask {
  const camera = new OrthographicCamera(-1, 1, 1, -1, 0, 1);
  const scene = new Scene();
  const quad = createInstancedQuad();
  scene.add(quad.mesh);
  const materials: Partial<Record<HighlightShape, ShaderMaterial>> = {};
  let target: WebGLRenderTarget | null = null;

  const ensureTarget = (): WebGLRenderTarget => {
    if (target !== null) return target;
    target = new WebGLRenderTarget(side, side, { depthBuffer: false, generateMipmaps: false, minFilter: LinearFilter, magFilter: LinearFilter, wrapS: RepeatWrapping, wrapT: RepeatWrapping, format: RedFormat, type: UnsignedByteType });
    target.texture.colorSpace = NoColorSpace;
    withRendererState(renderer, () => {
      renderer.setRenderTarget(target);
      renderer.setClearColor(0x000000, 0);
      renderer.clear();
    });
    return target;
  };

  return {
    paint(stamps, shape) {
      if (stamps.length === 0) return;
      const mask = ensureTarget();
      withRendererState(renderer, () => {
        renderer.autoClear = false;
        quad.mesh.material = materials[shape] ??= createMaskMaterial(shape);
        let count = 0;
        const flush = (): void => {
          if (count === 0) return;
          setInstanceCount(quad, count);
          renderer.setRenderTarget(mask);
          renderer.render(scene, camera);
          count = 0;
        };
        for (const stamp of stamps) {
          for (const centre of wrapInstances(stamp)) {
            quad.place.set([centre.x, centre.y, stamp.size, 0], count * 4); // a highlight keeps the picture's axes (clone R3)
            count += 1;
            if (count === INSTANCES_PER_DRAW) flush();
          }
        }
        flush();
      });
    },
    clear() {
      if (target === null) return;
      const mask = target;
      withRendererState(renderer, () => {
        renderer.setRenderTarget(mask);
        renderer.setClearColor(0x000000, 0);
        renderer.clear();
      });
    },
    texture: () => target?.texture ?? null,
    dispose() {
      target?.dispose();
      target = null;
      for (const material of Object.values(materials)) material.dispose();
      quad.geometry.dispose();
    },
  };
}
