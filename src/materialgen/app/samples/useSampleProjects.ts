import { useEffect, useRef, useState } from 'react';
import { importMaterialZip, type MaterialImportTarget, type MaterialProjectStore } from '@mat/storage';
import { BUNDLED_SAMPLES } from '@mat/samples/bundledSamples';
import { seedSampleProjects, type SampleSource } from '@mat/samples/seedSampleProjects';
import { APP_ID } from '../appIdentity';
import { estimateFreeBytes } from '../project/estimateFreeBytes';

type SampleStore = MaterialImportTarget & Pick<MaterialProjectStore, 'loadAppSettings' | 'saveAppSettings'>;

const PAINT_FALLBACK_MS = 300; // a hidden tab never paints; the import must not wait for it

/** Resolves after the next paint, so what the user sees first (the welcome, tutorial R21) is on screen before the import starts. */
function afterNextPaint(): Promise<void> {
  return new Promise((resolve) => {
    const fallback = setTimeout(resolve, PAINT_FALLBACK_MS);
    const done = (): void => {
      clearTimeout(fallback);
      resolve();
    };
    if (typeof requestAnimationFrame === 'function') requestAnimationFrame(() => setTimeout(done, 0));
  });
}

export interface SampleProjectsState {
  checked: boolean; // the flag has been read; until then the list is not shown, so the empty state never flashes
  remaining: number; // samples still to come, shown as placeholder cards
  refresh: number; // changes after every sample, so the list reads again
  failures: string[];
}

/** Materialgen/default-projects R11, R12: at the first start of the app, imports the bundled samples one by one and tells the list how many are still coming. */
export function useSampleProjects(store: SampleStore, samples: readonly SampleSource[] = BUNDLED_SAMPLES): SampleProjectsState {
  const [state, setState] = useState<SampleProjectsState>({ checked: false, remaining: 0, refresh: 0, failures: [] });
  const started = useRef(false);

  useEffect(() => {
    if (started.current) return;
    started.current = true;
    void (async () => {
      const seeded = (await store.loadAppSettings()).samplesLoaded;
      setState({ checked: true, remaining: seeded ? 0 : samples.length, refresh: 0, failures: [] });
      if (seeded) return;
      await afterNextPaint();
      const outcome = await seedSampleProjects(
        {
          isSeeded: async () => (await store.loadAppSettings()).samplesLoaded,
          markSeeded: () => store.saveAppSettings({ samplesLoaded: true }),
          samples,
          importZip: (zip) => importMaterialZip(store, zip, undefined, { appId: APP_ID, estimateFreeBytes }),
        },
        (remaining) => setState((current) => ({ ...current, remaining, refresh: current.refresh + 1 })),
      );
      setState((current) => ({ ...current, remaining: 0, failures: outcome.failures }));
    })();
  }, [store, samples]);

  return state;
}
