import { createContext, useContext, useEffect, useSyncExternalStore } from 'react';
import { createViewAngleStore, type ViewAngleStore } from './viewAngleStore';

/** Imageops R72: where the plane picker finds the turn of the picture. Without a provider the picture stands upright. */
export const ViewAngleContext = createContext<ViewAngleStore>(createViewAngleStore());

/** The turn of the picture in the view, in degrees clockwise; re-renders only the component that asks, and tells the store a picker is on screen (R74). */
export function useViewAngle(): number {
  const store = useContext(ViewAngleContext);
  useEffect(() => store.watch(), [store]);
  return useSyncExternalStore(store.subscribe, store.get);
}

/** True while a picker is on screen; the host uses it to run the viewport's angle reader only then (R74). */
export function useViewAngleWatched(store: ViewAngleStore): boolean {
  return useSyncExternalStore(store.subscribeWatched, store.isWatched);
}
