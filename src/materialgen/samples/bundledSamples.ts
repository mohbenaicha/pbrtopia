import type { SampleSource } from './seedSampleProjects';

// The sample project zips that ship with the app build (materialgen/default-projects R11): static files, fetched when the first start imports them.
const URLS = import.meta.glob('../data/default-projects/*.zip', { query: '?url', import: 'default', eager: true }) as Record<string, string>;

const nameOf = (path: string): string => (path.split('/').pop() ?? path).replace(/\.zip$/i, '');

export const BUNDLED_SAMPLES: readonly SampleSource[] = Object.entries(URLS)
  .sort(([one], [other]) => one.localeCompare(other))
  .map(([path, url]) => ({
    name: nameOf(path),
    open: async () => {
      const response = await fetch(url);
      if (!response.ok || response.body === null) throw new Error(`The file could not be loaded (${response.status}).`);
      return response.body;
    },
  }));
