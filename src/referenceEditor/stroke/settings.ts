import type { ToolId } from '../machine/interaction';

export const MIN_BRUSH_SIZE = 1;
export const MAX_BRUSH_SIZE = 256;
export const DEFAULT_BRUSH_SIZE = 24;

/** Editor settings shared by the tools (view state, passed into every tool call). */
export interface EditorSettings {
  tool: ToolId;
  colour: number;
  brushSize: number;
}

export const clampBrushSize = (size: number): number => Math.min(MAX_BRUSH_SIZE, Math.max(MIN_BRUSH_SIZE, Math.round(size)));

/** Sideways movement that sweeps the whole size range (the same feel as material compositing's resize). */
const SIZE_SWEEP_PIXELS = 600;

/** Shift-move: the size (kept as a real number by the caller) changes evenly with sideways movement; clamped to 1..256, not rounded. */
export const resizeBrushBy = (size: number, moveX: number): number =>
  Math.min(MAX_BRUSH_SIZE, Math.max(MIN_BRUSH_SIZE, size + ((MAX_BRUSH_SIZE - MIN_BRUSH_SIZE) * moveX) / SIZE_SWEEP_PIXELS));

/** `[` / `]`: 10 % of the size, at least 1, kept inside 1..256. */
export function stepBrushSize(size: number, direction: 1 | -1): number {
  return clampBrushSize(size + direction * Math.max(1, Math.round(size * 0.1)));
}
