import type { Texture, WebGLRenderer } from 'three';
import type { NormalDirection } from '@mat/storage';
import type { PreviewScene } from './createPreviewScene';

/** Compositing R25: the textures a painting session draws into, standing in for the stored map of each slot while it is open. */
export type PaintTextures = Readonly<Partial<Record<'albedo' | 'normal' | 'height' | 'orm', Texture>>>;

/** Compositing R27: a ray in the Plane's own frame (x and y in [-0.5, 0.5], z up). */
export interface LocalRay {
  origin: [number, number, number];
  direction: [number, number, number];
}

/** Preview R15 and R34 as the Plane has them now: the displacement `z = height x scale + bias` and the tiling of each axis. */
export interface PaintSurface {
  scale: number;
  bias: number;
  tilingX: number;
  tilingY: number;
}

/** What the preview hands the painting session: the scene's hooks, the renderer the textures live in and the canvas the pointer is on (compositing A5). */
export interface PaintHost {
  scene: PreviewScene;
  renderer: WebGLRenderer;
  element: HTMLElement;
  normalDirection(): NormalDirection; // the app-wide setting now (preview R60)
  invalidate(): void; // asks for a frame (the viewport draws on demand; R25)
}
