import { flux3ImagePlugin } from './models/flux3Image';
import { kreaK3EditPlugin } from './models/kreaK3Edit';
import { maiImage27Plugin } from './models/maiImage27';
import { seedream55Plugin } from './models/seedream55';
import type { OpenRouterModelPlugin } from './openrouterModelPlugin';

// R44: the OpenRouter models the app offers, one line each. Removing a model: delete its file in models/, its import and its line here.
export const OPENROUTER_MODELS: readonly OpenRouterModelPlugin[] = [
  seedream55Plugin,
  maiImage27Plugin,
  flux3ImagePlugin,
  kreaK3EditPlugin,
];

export const findOpenRouterPlugin = (id: string, plugins: readonly OpenRouterModelPlugin[] = OPENROUTER_MODELS): OpenRouterModelPlugin | null =>
  plugins.find((plugin) => plugin.row.id === id) ?? null;
