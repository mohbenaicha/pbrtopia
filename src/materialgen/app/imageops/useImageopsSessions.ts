import { useEffect, useMemo, useRef } from 'react';
import { WebGLRenderer } from 'three';
import {
  createAoSession, createFilterSession, createGpuContext, mirrorMap, scaleRectToSquare, swapDiagonals,
  type AoSource, type CropRect, type EditMapKind, type EditValues, type FilterSession, type GpuContext, type MirrorPlan, type OpSession, type PixelImage,
} from '@mat/imageops';

/** The geometry ops of imageops R24-R36, each on one map as the kind it is. The live preview of Crop and Mirror is not one of them: it is in the viewport's shaders (R53). */
export interface GeometryOps {
  crop(image: PixelImage, kind: EditMapKind, rect: CropRect, size: number): Promise<PixelImage>;
  mirror(image: PixelImage, kind: EditMapKind, plan: MirrorPlan): Promise<PixelImage>;
  swap(image: PixelImage, kind: EditMapKind): Promise<PixelImage>;
}

/** Opens op sessions on a map's working copy (imageops R7, R9). The dialogs depend on this, not on the graphics card. */
export interface ImageopsSessions {
  openFilter(image: PixelImage, kind: EditMapKind): Promise<FilterSession>;
  openAo(image: PixelImage, source: AoSource): Promise<OpSession<EditValues>>;
  geometry: GeometryOps;
}

/**
 * Imageops R1, R8: one offscreen renderer for the whole project view, made when the first op session opens (a project that is never edited
 * never touches the graphics card) and released with the view, which frees every pooled target.
 */
export function useImageopsSessions(): ImageopsSessions {
  const gpu = useRef<{ renderer: WebGLRenderer; context: GpuContext } | null>(null);
  useEffect(
    () => () => {
      gpu.current?.context.dispose();
      gpu.current?.renderer.dispose();
      gpu.current = null;
    },
    [],
  );
  return useMemo<ImageopsSessions>(() => {
    const context = (): GpuContext => {
      if (gpu.current === null) {
        const renderer = new WebGLRenderer({ canvas: document.createElement('canvas'), antialias: false, alpha: false });
        gpu.current = { renderer, context: createGpuContext(renderer) };
      }
      return gpu.current.context;
    };
    return {
      openFilter: async (image, kind) => createFilterSession(context(), { image, kind }),
      openAo: async (image, source) => createAoSession(context(), { image, source }),
      geometry: {
        crop: async (image, kind, rect, size) => scaleRectToSquare(context(), { image, kind }, rect, size),
        mirror: async (image, kind, plan) => mirrorMap(context(), { image, kind }, plan),
        swap: async (image, kind) => swapDiagonals(context(), { image, kind }),
      },
    };
  }, []);
}
