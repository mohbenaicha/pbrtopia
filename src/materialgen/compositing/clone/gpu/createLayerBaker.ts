import { Mesh, OrthographicCamera, PlaneGeometry, Scene, WebGLRenderer, type ShaderMaterial, type Texture } from 'three';
import type { JournalKind, StampPainter } from '../../gpu/createStampPainter';
import { withRendererState } from '../../gpu/withRendererState';
import { frameOf, wrappedCopies, type Placement } from '../plan/placement';
import { createBakeMaterial, type BakeKind } from './cloneShaders';
import type { CloneLayer } from './createCloneLayer';

export interface LayerBaker {
  /**
   * Clone R9-R11, R14, R15: draws the layer, placed, into every map in `kinds` (already made and journaled by the caller), once per wrapped copy (one to four). `fade` is the
   * edge fade of the layer's rectangle; `strength` (0-1) scales it. O(copies x placed area) per kind; nothing is read back.
   */
  bake(request: { painter: StampPainter; layer: CloneLayer; fade: Texture; placement: Placement; strength: number; kinds: readonly JournalKind[] }): void;
  dispose(): void;
}

/** One draw per kind and copy into the painter's live targets; the compositing R17 colour mask keeps AO out of the packed texture. */
export function createLayerBaker(renderer: WebGLRenderer): LayerBaker {
  const camera = new OrthographicCamera(-1, 1, 1, -1, 0, 1);
  const scene = new Scene();
  const geometry = new PlaneGeometry(1, 1);
  const quad = new Mesh(geometry);
  quad.frustumCulled = false;
  scene.add(quad);
  const materials: Partial<Record<BakeKind, ShaderMaterial>> = {};

  return {
    bake({ painter, layer, fade, placement, strength, kinds }) {
      const frame = frameOf(layer.rect, painter.side);
      const copies = wrappedCopies(frame, placement);
      const sources = { colour: layer.colour, surface: layer.surface, normal: layer.normal ?? layer.surface, fade };
      withRendererState(renderer, () => {
        const gl = renderer.getContext() as WebGL2RenderingContext;
        renderer.autoClear = false;
        for (const kind of kinds) {
          const target = painter.journalTarget(kind);
          if (target === null) throw new Error(`The ${kind} target was not made before the bake`);
          const material = (materials[kind] ??= createBakeMaterial(kind, sources, painter.normalYSign));
          material.uniforms['uColour']!.value = sources.colour;
          material.uniforms['uSurface']!.value = sources.surface;
          material.uniforms['uNormal']!.value = sources.normal;
          material.uniforms['uFade']!.value = sources.fade;
          material.uniforms['uFrame']!.value = [frame.w, frame.h, placement.scale];
          material.uniforms['uAngle']!.value = placement.angle;
          material.uniforms['uStrength']!.value = strength;
          material.uniforms['uYSign']!.value = painter.normalYSign;
          quad.material = material;
          if (kind === 'orm') gl.colorMask(false, true, true, false); // roughness and metal only
          for (const copy of copies) {
            material.uniforms['uCentre']!.value = [copy.cx, copy.cy];
            renderer.setRenderTarget(target);
            renderer.render(scene, camera);
          }
          if (kind === 'orm') gl.colorMask(true, true, true, true);
        }
      });
    },
    dispose() {
      for (const material of Object.values(materials)) material.dispose();
      geometry.dispose();
    },
  };
}
