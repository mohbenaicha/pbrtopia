import { useSyncExternalStore } from 'react';
import type { TourController } from './TourController';
import type { TourSnapshot } from './tourTypes';

/** The tour's current state, re-read whenever the controller changes it. */
export function useTour(controller: TourController): TourSnapshot {
  return useSyncExternalStore(controller.subscribe, controller.snapshot, controller.snapshot);
}
