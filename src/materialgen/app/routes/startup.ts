import { decideStartup as decideShellStartup, type StartupDecision as ShellStartupDecision, type StartupStore } from '@shared/shell';
import { router, type SettingsSection } from './router';

export type StartupDecision = ShellStartupDecision<SettingsSection>;

/** Where the material app lands at start (materialgen app R9), by its own address scheme. */
export const decideStartup = (hash: string, store: StartupStore): Promise<StartupDecision> => decideShellStartup(hash, store, router);
