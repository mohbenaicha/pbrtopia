import { createRouter, type Route as ShellRoute } from '@shared/shell';

export { listHash, projectHash, type AddressKind } from '@shared/shell';

/** Materialgen app R9, R40: the settings sections in navigation order, `keys` first. */
export const SETTINGS_SECTIONS = ['keys', 'models', 'viewport', 'shortcuts', 'storage'] as const;
export type SettingsSection = (typeof SETTINGS_SECTIONS)[number];

export type Route = ShellRoute<SettingsSection>;

/** The material app's address scheme: the shared router over its own sections. */
export const router = createRouter(SETTINGS_SECTIONS);
export const { settingsHash, classifyAddress, parseHash, watchRoute } = router;
