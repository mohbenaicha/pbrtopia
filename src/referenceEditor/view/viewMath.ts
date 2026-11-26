import type { Point } from '../model/geometry';

/** Where the picture sits in the stage: stage point = image point * scale + (x, y). Zoom and pan only change this, never a pixel (R5). */
export interface ViewTransform { scale: number; x: number; y: number }

export const MIN_SCALE = 0.05;
export const MAX_SCALE = 32;
/** Above this zoom pixels are drawn as sharp squares (R5). */
export const PIXELATED_ABOVE = 2;
const FIT_MARGIN = 16;

export const clampScale = (scale: number): number => Math.min(MAX_SCALE, Math.max(MIN_SCALE, scale));

export function fitTransform(stage: { w: number; h: number }, image: { w: number; h: number }): ViewTransform {
  const scale = clampScale(Math.min((stage.w - 2 * FIT_MARGIN) / image.w, (stage.h - 2 * FIT_MARGIN) / image.h));
  return { scale, x: (stage.w - image.w * scale) / 2, y: (stage.h - image.h * scale) / 2 };
}

/** Zooms by `factor` keeping the image point under stage point `at` where it is. */
export function zoomAround(view: ViewTransform, at: Point, factor: number): ViewTransform {
  const scale = clampScale(view.scale * factor);
  const ratio = scale / view.scale;
  return { scale, x: at.x - (at.x - view.x) * ratio, y: at.y - (at.y - view.y) * ratio };
}

export const panBy = (view: ViewTransform, dx: number, dy: number): ViewTransform => ({ ...view, x: view.x + dx, y: view.y + dy });

export const toImagePoint = (view: ViewTransform, stage: Point): Point => ({ x: (stage.x - view.x) / view.scale, y: (stage.y - view.y) / view.scale });

export const cssTransformOf = (view: ViewTransform): string => `translate(${view.x}px, ${view.y}px) scale(${view.scale})`;

/** Wheel notch to zoom factor: smooth for trackpads, 25 % per classic notch. */
export const wheelFactor = (deltaY: number): number => Math.exp(-Math.sign(deltaY) * Math.min(Math.abs(deltaY), 100) * 0.0022);
