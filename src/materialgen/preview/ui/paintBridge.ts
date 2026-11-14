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
  setMeshChanger(changer: ((mesh: PreviewMesh) => void) | null): void; // the preview's side: how the tool may ask for a mesh (R55)
  showMesh(mesh: PreviewMesh, limitMs?: number): Promise<boolean>; // the tool's side: true once the preview shows `mesh` with its host, false when it cannot or is too slow
}

const SHOW_MESH_LIMIT_MS = 4000;

export function createPaintBridge(): PaintBridge {
  let current: PaintBridgeState = { host: null, mesh: 'ball' };
  let guard: ((mesh: PreviewMesh) => Promise<boolean>) | null = null;
  let changer: ((mesh: PreviewMesh) => void) | null = null;
  const listeners = new Set<() => void>();
  const shows = (mesh: PreviewMesh): boolean => current.mesh === mesh && current.host !== null;
  const subscribe = (listener: () => void): (() => void) => {
    listeners.add(listener);
    return () => void listeners.delete(listener);
  };
  return {
    state: () => current,
    subscribe,
    publish(next) {
      if (next.host === current.host && next.mesh === current.mesh) return;
      current = next;
      for (const listener of [...listeners]) listener();
    },
    setMeshGuard(next) {
      guard = next;
    },
    allowMeshChange: async (mesh) => (guard === null ? true : guard(mesh)),
    setMeshChanger(next) {
      changer = next;
    },
    showMesh(mesh, limitMs = SHOW_MESH_LIMIT_MS) {
      if (shows(mesh)) return Promise.resolve(true);
      if (changer === null) return Promise.resolve(false);
      return new Promise<boolean>((resolve) => {
        const finish = (done: boolean): void => {
          clearTimeout(timer);
          unsubscribe();
          resolve(done);
        };
        const unsubscribe = subscribe(() => {
          if (shows(mesh)) finish(true);
        });
        const timer = setTimeout(() => finish(false), limitMs);
        changer?.(mesh);
      });
    },
  };
}

/** The bridge's state as a React value; renders again when the preview publishes. */
export function usePaintBridgeState(bridge: PaintBridge): PaintBridgeState {
  return useSyncExternalStore(bridge.subscribe, bridge.state);
}
