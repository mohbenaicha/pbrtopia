import { useAddressWatcher as useShellAddressWatcher, type StartupStore } from '@shared/shell';
import { router, type Route } from './router';
import type { StartupDecision } from './startup';

/** The route the address stands for in the material app, kept up to date as it changes (materialgen app R9). */
export function useAddressWatcher(store: StartupStore, initial: StartupDecision): { route: Route; notice: StartupDecision['notice']; dismissNotice(): void } {
  return useShellAddressWatcher(store, initial, router);
}
