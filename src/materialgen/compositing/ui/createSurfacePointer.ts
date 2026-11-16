import type { PaintHost } from '@mat/preview';
import type { Point } from '../plan/planStamps';
import { createHeightProxy, pickSurface } from '../session/pickSurface';

const GHOST_LIFT = 0.002; // what follows the surface sits a little above it

/** Compositing R26: the proxy is at most 512 wide; this one is 256. */
export const PROXY_SIDE = 256;
const PROXY_INTERVAL_MS = 100;

export interface SurfacePointer {
  /** The picture point under a pointer event, or null off the plane or the picture (compositing R32). */
  pointAt(event: { clientX: number; clientY: number }): Point | null;
  /** The height above the plane at which something that follows the surface at `point` is drawn. */
  liftAt(point: Point): number;
  /** The painted height changed: the proxy the pick reads is out of date. */
  markDirty(): void;
  /** Reads the proxy again at once. */
  refresh(): void;
  /** Reads it again when it is dirty and the work is done, or when enough time passed during the work (compositing R26). */
  refreshIfDue(workRemains: boolean): void;
}

export interface SurfacePointerOptions {
  host: Pick<PaintHost, 'scene' | 'element'>;
  /** The session's height proxy at `side`, or null while it has no height map. */
  readProxy(side: number): Uint8Array | null;
}

/** Compositing A5: the pointer-to-picture mapping both tool modes share, with the height proxy the pick reads. */
export function createSurfacePointer(options: SurfacePointerOptions): SurfacePointer {
  const { scene, element } = options.host;
  let heightAt: (u: number, v: number) => number = () => 0.5;
  let dirty = true;
  let lastAt = 0;
  const refresh = (): void => {
    const bytes = options.readProxy(PROXY_SIDE);
    dirty = false;
    lastAt = performance.now();
    if (bytes !== null) heightAt = createHeightProxy(bytes, PROXY_SIDE);
  };
  return {
    pointAt(event) {
      const rect = element.getBoundingClientRect();
      if (rect.width === 0 || rect.height === 0) return null;
      const ray = scene.planeRay(((event.clientX - rect.left) / rect.width) * 2 - 1, -(((event.clientY - rect.top) / rect.height) * 2 - 1));
      if (ray === null) return null;
      return pickSurface(ray.origin, ray.direction, { height: heightAt, ...scene.paintSurface() });
    },
    liftAt(point) {
      const surface = scene.paintSurface();
      return heightAt(point.x, point.y) * surface.scale + surface.bias + GHOST_LIFT;
    },
    markDirty: () => { dirty = true; },
    refresh,
    refreshIfDue(workRemains) {
      if (dirty && (!workRemains || performance.now() - lastAt >= PROXY_INTERVAL_MS)) refresh();
    },
  };
}
