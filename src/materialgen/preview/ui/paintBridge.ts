import { useSyncExternalStore } from 'react';
import type { PreviewMesh } from '@mat/storage';
import type { PaintHost } from '../scene/paintHost';

/** What the app can see of the preview while it paints: the host (null until the scene exists) and the mesh shown. */
export interface PaintBridgeState {
  host: PaintHost | null;
  mesh: PreviewMesh;
}

/**
 * Compositing R1, R3, R4: the one meeting point of the painting tool (in the maps panel) and the preview (which owns the scene and the mesh choice). The preview
 * publishes its host and mesh; the tool reads them, and may set a guard that the mesh picker asks before it changes the mesh while a session is open.
 */
export interface PaintBridge {
  state(): PaintBridgeState;
  subscribe(listener: () => void): () => void;
  publish(state: PaintBridgeState): void; // the preview's side
  setMeshGuard(guard: ((mesh: PreviewMesh) => Promise<boolean>) | null): void; // the tool's side
  allowMeshChange(mesh: PreviewMesh): Promise<boolean>; // the preview asks before it changes the mesh
}

export function createPaintBridge(): PaintBridge {
  let current: PaintBridgeState = { host: null, mesh: 'ball' };
  let guard: ((mesh: PreviewMesh) => Promise<boolean>) | null = null;
  const listeners = new Set<() => void>();
  return {
    state: () => current,
    subscribe(listener) {
      listeners.add(listener);
      return () => void listeners.delete(listener);
    },
    publish(next) {
      if (next.host === current.host && next.mesh === current.mesh) return;
      current = next;
      for (const listener of [...listeners]) listener();
    },
    setMeshGuard(next) {
      guard = next;
    },
    allowMeshChange: async (mesh) => (guard === null ? true : guard(mesh)),
  };
}

/** The bridge's state as a React value; renders again when the preview publishes. */
export function usePaintBridgeState(bridge: PaintBridge): PaintBridgeState {
  return useSyncExternalStore(bridge.subscribe, bridge.state);
}
